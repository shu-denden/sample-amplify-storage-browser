import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'myStorageBucket',
  isDefault: true,
   access: (allow) => ({
    'public/*': [
        allow.guest.to(['read']),
        allow.authenticated.to(['read']),
    ],
    'admin/*': [
        allow.groups(['admin']).to(['read']),
        allow.authenticated.to(['read'])
    ],
    'private/{entity_id}/*': [
        allow.entity('identity').to(['read'])
    ]
   })
});

export const secondaryStorage = defineStorage({
  name: 'myTestStorageBucket',
   access: (allow) => ({
    'Test_01/*': [
        allow.guest.to(['read', 'write']),
        allow.authenticated.to(['read', 'write', 'delete']),
    ],
    'Test_02/*': [
        allow.groups(['admin']).to(['read', 'write', 'delete']),
        allow.authenticated.to(['read'])
    ],
    'Test_03_entityId/{entity_id}/*': [
        allow.entity('identity').to(['read', 'write', 'delete'])
    ]
   })
});



