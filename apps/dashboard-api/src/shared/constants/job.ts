export const JOB = {
    DEVICE: {
        NAME: 'device',
        CREATE: 'device:create',
        DELETE: 'device:delete',
        REMOVE_EMPLOYEES: 'device:removeEmployeesFromDevices',
        CLEAR_ALL_USERS_FROM_DEVICE: 'device:clearAllUsersFromDevice',
        SYNC_SINGLE_CREDENTIAL: 'device:syncSingleCredential',
        REMOVE_SPECIFIC_CREDENTIALS: 'device:removeSpecificCredentials',
        SYNC_CREDENTIALS_TO_DEVICES: 'device:syncCredentialsToDevices',
        DEVICE_SYNC_EMPLOYEES: 'device:deviceSyncEmployees',
        DEVICE_REMOVE_EMPLOYEES: 'device:deviceRemoveEmployees',
    },
    ATTENDANCE: {
        NAME: 'attandance',
        CREATE_DEFAULT: 'attandance:createDefault',
        MARK_ABSENT: 'attandance:markAbsent',
        MARK_GONE: 'markGone',
    },
    VISITOR: {
        NAME: 'visitor',
        ASSIGN_TO_GATES: 'visitor:assignToGates',
        UPDATE: 'visitor:update',
        DELETE: 'visitor:delete',
    },
};
