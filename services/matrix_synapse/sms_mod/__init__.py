from typing import Any, Dict
import redis
import attr
import requests
import json
from synapse.module_api import ModuleApi


@attr.s(auto_attribs=True, frozen=True)
class SmsModuleConfig:
    pass


class SmsModule:
    def __init__(self, config: SmsModuleConfig, api: ModuleApi):
        # Keep a reference to the config and Module API
        self._api = api
        self._config = config
        self._api.register_third_party_rules_callbacks(
            on_new_event=self.tick,
        )
    
    global red 
    red = redis.Redis(host='127.0.0.1', port=6379, db=0)

    @staticmethod
    def parse_config(config: Dict[str, Any]) -> SmsModuleConfig:
        # Parse the module's configuration here.
        # If there is an issue with the configuration, raise a
        # synapse.module_api.errors.ConfigError.
        #
        # Example:
        #
        #     some_option = config.get("some_option")
        #     if some_option is None:
        #          raise ConfigError("Missing option 'some_option'")
        #      if not isinstance(some_option, str):
        #          raise ConfigError("Config option 'some_option' must be a string")
        #
        return SmsModuleConfig()

    async def tick(self, event, state):
        while True:
            await self.dossi_handle(self, event, state)
            await self.tick(self, event, state)
            
    async def dossi_handle(self, event, state):
        if event.type == "room.message" or event.type == "m.room.encrypted":
            message = event.content.body
            if message.index("dossi") == 0:
                #TODO add check for correct pin
                global handles
                handles = []
                keyArray = red.keys('extfor.*')
                for key in keyArray:
                    if red.get(key) == message[6:9]:
                        handle = key[7:17]
                        handles.append(handle)
                

    async def tick(self, event, state):
       queueLength = red.llen('sms-in')
       i = 0
       while i < queueLength:
           value = red.lindex('sms-in', i)
           decoded = json.loads(str(value))
           global to
           for h in handles:
               if decoded['to'] == h:
                   to = h
                   red.lrem('sms-in', 1, value)
                   global fakeUser
                   fakeUser = self._api.register(decoded['from'] + '.' + decoded['to'])
                # http request  
                #    self._api.create_and_send_event_into_room(
                #        {
                #            "state_key":"",
                #            "type":"m.room.create",
                #            "sender": fakeUser[0],
                #            "content": {
                #                "creater": fakeUser[0],
                #                "room_version": '9',
                #            }
                #        }
                #    )
                   # Get room info
                   self._api.create_and_send_event_into_room(
                       {
                           "room_id": "",
                           "state_key": "",
                           "type": "m.room.message",
                           "sender": fakeUser[0],
                           "content": {
                            "body": decoded['message']
                           }
                       }
                   )
                   
          
    
    
   

                



        
