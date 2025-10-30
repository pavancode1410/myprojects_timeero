module.exports = {
    TSHEETS_USERS_URL: 'https://rest.tsheets.com/api/v1/users',
    TIMEERO_USERS_URL: 'https://api.timeero.app/api/public/users',
    TIMEERO_JOBCODES_URL: 'https://api.timeero.app/api/public/jobs',

    TSHEETS_TOKEN: process.env.TSHEETS_TOKEN || 'S.7__PLACEHOLDER_TOKEN',
    TIMEERO_TOKEN: process.env.TIMEERO_TOKEN || 'Essh2i3vy_PLACEHOLDER_TOKEN',

    DEFAULT_PHONE_PREFIX: '1',
    DEFAULT_PASSWORD_LENGTH: 10
};
