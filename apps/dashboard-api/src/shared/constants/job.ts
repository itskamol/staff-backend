export const JOB = {
    DEVICE: {
        NAME: 'device',
        CREATE: 'device:create',
        DELETE: 'device:delete',
        ASSIGN_EMPLOYEES_TO_GATES: 'device:assignEmployees',
        REMOVE_GATE_EMPLOYEE_DATA: 'device:removeEmployeeData',
        REMOVE_EMPLOYEES: 'device:removeEmployeesFromDevices',
        CLEAR_ALL_USERS_FROM_DEVICE: 'device:clearAllUsersFromDevice',
        SYNC_SINGLE_CREDENTIAL: 'device:syncSingleCredential',
        REMOVE_SPECIFIC_CREDENTIALS: 'device:removeSpecificCredentials',
        SYNC_CREDENTIALS_TO_DEVICES: 'device:syncCredentialsToDevices',
    },
    ATTENDANCE: {
        NAME: 'attandance',
        CREATE_DEFAULT: 'attandance:createDefault',
        MARK_ABSENT: 'attandance:markAbsent',
        MARK_GONE: 'markGone',
    },
};
