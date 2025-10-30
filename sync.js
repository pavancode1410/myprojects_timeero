const { chromium } = require('@playwright/test');
const config = require('./config');

function generateStrongPassword(length = config.DEFAULT_PASSWORD_LENGTH) {
    if (length < 6) length = 6;
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    const special = '!@#$%^&*()-_+=<>?';
    
    let chars = [
        lower[Math.floor(Math.random() * lower.length)],
        upper[Math.floor(Math.random() * upper.length)],
        digits[Math.floor(Math.random() * digits.length)],
        special[Math.floor(Math.random() * special.length)]
    ];
    
    const allChars = lower + upper + digits + special;
    for (let i = chars.length; i < length; i++) {
        chars.push(allChars[Math.floor(Math.random() * allChars.length)]);
    }
    
    for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    
    return chars.join('');
}

function generateRandomPhoneNumber() {
    let digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
    return `${config.DEFAULT_PHONE_PREFIX}${digits}`;
}

async function getTSheetsData(request) {
    const data = { users: [], jobcodes: [] };
    let page = 1;
    const perPage = 200;
    
    const headers = { 'Authorization': `Bearer ${config.TSHEETS_TOKEN}` };

    while (true) {
        const params = {
            page: page.toString(),
            per_page: perPage.toString(),
            active: 'yes',
            include: 'jobcodes'
        };

        const response = await request.get(config.TSHEETS_USERS_URL, { headers, params });
        
        if (response.status() === 401) {
            console.error("Authentication Error: TSheets token is invalid.");
            throw new Error("TSheets API Authentication Failed. Check TSHEETS_TOKEN.");
        }
        
        const json = await response.json();
        
        const users = json.results?.users || {};
        data.users.push(...Object.values(users));

        if (page === 1) {
            data.jobcodes = Object.values(json.supplemental_data?.jobcodes || {});
        }

        if (json.more === 0) {
            break;
        }
        page++;
    }
    return data;
}

async function createTimeeroEntity(request, url, payload) {
    const headers = { 
        'Authorization': config.TIMEERO_TOKEN, 
        'Content-Type': 'application/json'
    };

    const response = await request.post(url, { headers, data: payload });
    const status = response.status();
    const json = await response.json();

    if (status === 200 || status === 201) {
        return { status: 'SUCCESS', id: json.items?.id, message: json.message, data: payload };
    } else if (status === 422) {
        const message = json.message || 'Unknown 422 error';
        if (message.includes("email has already been taken") || message.includes("Disposable email")) {
            return { status: 'SKIPPED', message: message, data: payload };
        }
        return { status: 'FAILED', message: message, data: payload };
    } else {
        return { status: 'ERROR', message: `HTTP Status ${status}: ${JSON.stringify(json)}`, data: payload };
    }
}

async function syncTSheetsToTimeero() {
    console.log("Starting TSheets to Timeero Synchronization...");
    
    const request = await chromium.request.newContext(); 
    
    const { users: tSheetsUsers, jobcodes: tSheetsJobcodes } = await getTSheetsData(request);
    console.log(`\n✅ Fetched ${tSheetsUsers.length} active users and ${tSheetsJobcodes.length} job codes from TSheets.`);

    const userMappings = [];
    const jobcodeMappings = [];
    
    console.log("\n--- Starting Job Code Creation ---");
    const jobcodePromises = tSheetsJobcodes.map(jobcode => {
        const payload = {
            name: jobcode.name || 'Unknown Jobcode',
            job_code: String(jobcode.id),
            active: jobcode.active,
            track_mileage: false,
            track_location: false
        };
        return createTimeeroEntity(request, config.TIMEERO_JOBCODES_URL, payload);
    });
    
    const jobcodeResults = await Promise.all(jobcodePromises);
    jobcodeResults.forEach(result => {
        jobcodeMappings.push({
            tsheets_job_id: result.data.job_code,
            tsheets_job_name: result.data.name,
            timeero_job_id: result.id || result.status,
            sync_status: result.status,
            message: result.message || ''
        });
        if (result.status === 'SUCCESS') {
            console.log(`   - Created Jobcode: ${result.data.name} (Timeero ID: ${result.id})`);
        }
    });

    console.log("\n--- Starting User Creation ---");
    const userPromises = tSheetsUsers.map(user => {
        const isUserAdmin = user.permissions?.admin === true;
        const phone = user.mobile_number && user.mobile_number.trim().length > 0 ? user.mobile_number : generateRandomPhoneNumber();
        
        const payload = {
            first_name: user.first_name || 'N/A',
            last_name: user.last_name || 'N/A',
            email: user.email,
            phone: phone,
            password: generateStrongPassword(),
            company_employee_id: String(user.id),
            role_id: isUserAdmin ? 1 : 3,
            track_location: false,
            track_mileage: false,
        };
        
        return createTimeeroEntity(request, config.TIMEERO_USERS_URL, payload);
    });

    const userResults = await Promise.all(userPromises);
    userResults.forEach(result => {
        userMappings.push({
            tsheets_user_id: result.data.company_employee_id,
            tsheets_user_email: result.data.email,
            timeero_user_id: result.id || result.status,
            sync_status: result.status,
            message: result.message || '',
            tsheets_payroll_id: result.data.tsheets_payroll_id || 'N/A' 
        });
        if (result.status === 'SUCCESS') {
            console.log(`   - Created User: ${result.data.email} (Role ID: ${result.data.role_id})`);
        }
    });

    console.log("\n=======================================================");
    console.log("            SYNC EXECUTION COMPLETE                    ");
    console.log("=======================================================");
    
    console.log("\n--- Final User Mappings ---");
    console.table(userMappings);
    
    console.log("\n--- Final Jobcode Mappings ---");
    console.table(jobcodeMappings);
}

syncTSheetsToTimeero().catch(error => {
    console.error("\n❌ FATAL SYNCHRONIZATION ERROR:", error.message);
    process.exit(1);
});
