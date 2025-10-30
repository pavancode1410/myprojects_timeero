Technical Project Summary: TSheets to Timeero Synchronization



Project Overview



This project delivers a robust, secure, and maintainable automation solution designed to synchronize User and Job Code data from QuickBooks Time (TSheets) to Timeero via their respective REST APIs. This solution is built on modern development practices and establishes a critical data flow necessary for accurate payroll and time reconciliation (e.g., exporting time data back to TSheets).



Why Playwright and Node.js? (The Strategic Value)



We chose to build this solution using Node.js and Playwright's API client over a simple scripting language (like Python or cURL) for several key reasons:



Professionalism and Maintainability: Node.js and its package management (package.json) provide a standard, scalable foundation that is easily understood and maintained by any developer.



Performance and Reliability: Playwright offers a highly optimized API client that efficiently handles parallel requests. This allows the script to create multiple users and job codes in Timeero concurrently, drastically reducing the overall synchronization time compared to sequential processing.



Security: The use of config.js ensures that sensitive API tokens are never hardcoded. Instead, they are securely loaded from environment variables (process.env), which is the mandatory security best practice for CI/CD environments (like GitLab).



Core Technical Implementation



The synchronization is managed by the sync.js file, which is structured into distinct, modular functions:



1\. Data Fetching and Pagination



Method: The getTSheetsData function uses Playwright's request.get() to communicate with the TSheets API.



Pagination Handled: TSheets limits data per request. The function automatically handles pagination, looping through multiple pages until the json.more === 0 flag is returned, guaranteeing that all active users and job codes are captured.



Efficiency: It uses the include=jobcodes parameter in the initial user request to retrieve job code data in a single call, optimizing network traffic.



2\. Business Logic and Data Transformation



The script applies specific business rules to ensure data integrity in Timeero:



Role Mapping: We implemented a check on the TSheets user's permissions.admin field. If true, the Timeero payload sets the user's role to Admin (role\_id: 1); otherwise, it defaults to Employee (role\_id: 3).



Password and Phone Generation: The script generates a unique, strong password for every new user, as Timeero requires this for account activation. It also prioritizes using the TSheets mobile\_number field, falling back to a generated number only if none is provided.



Job Code Mapping: The TSheets jobcode.id is explicitly mapped to Timeero's job\_code field to establish a reliable foreign key link for future reconciliation.



3\. Parallel API Submission



Method: The script uses Promise.all() to execute all Timeero user creation requests and all job code creation requests in parallel. This concurrent execution ensures the sync completes in the shortest time possible.



Project Success and Audit Trail



The current synchronization project successfully achieves high reliability through robust handling of API responses:



Comprehensive Error Handling: The createTimeeroEntity function checks the HTTP status code and the JSON response for specific error conditions:



HTTP 200/201: Marked as SUCCESS. The new Timeero ID is captured.



HTTP 422 (Validation Error): Checked for key messages:



"Email already taken" or "Disposable email": Marked as SKIPPED to prevent API errors and notify the user about data cleanliness issues.



Other Errors: Marked as FAILED with the full error message for easy debugging.



Final Audit Report: Upon completion, the script prints a final audit table (console.table). This table provides a complete record of the TSheets ID, the resulting Timeero ID, and the final sync status for every single entity. This report is essential proof of success for every run and will be visible in the GitLab CI/CD job logs.

