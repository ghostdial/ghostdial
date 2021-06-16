# ghostdial

Ghostdial is a replacement for the worldwide phone systems we are used to. It is designed to run on a single server and consists of the following services, run as docker containers

- redis
- asterisk (SIP/telephony server)
  - ghostdial/extensions.lua (LUA script that defines how inbound / outbound calls are handled)
- prosody (XMPP server)
  - ghostdial/prosody_mod_sms (translates SMS/MMS from the Redis pipeline into XMPP messages)
- ghostdial/sms_pipeline (nodejs process which sends SMS/MMS between Redis and an external VoIP service)
- ghostdial/voicemail_pipeline (nodejs process which retrieves voicemail from asterisk, uploads to IPFS, uses Google Cloud to transcribe the audio into a written message, then forwards the transcript and audio file as an XMPP message to the user's telephone number as it is registered on prosody)
- ghostdial/registry (nodejs process which can be queried over HTTP to resolve a phone number to another ghostdial server, used for routing outbound calls, and validating inbound calls)
- coturn (Used for NAT traversal)


## Usage

Acquire SSL certificates for your hostname, acquire ghostdial SIP credentials, then run the stack in docker-compose.

For voice, use Zoiper Premium (Android), Linphone (Ubuntu, Mac, Windows), or Acrobits Groundwire (iOS) to connect to <extension>@<yourhost>:35061 over TLS with STUN enabled and set to <yourhost>:3478 and audio codec set to g.711 (ulaw). Turn SRTP encryption on.

For messaging, use Conversations (Android), Gajim (Windows), Beagle IM (Mac OSX), Dino (Linux), or Siskin IM (iOS) to connect to <phone_number>@<your_host> over XMPP with TLS and OMEMO enabled to connect to the messaging service.

On your voice app, you can operate as many numbers as you've registered from your single extension. When a call comes through, ghostdial will prepend the callerid with the phone number that the call is coming through, followed by the caller's name and number. Ghostdial will remember the number that the caller called through, and when you dial that person back, ghostdial will use the number they called to call them back. If you want to explicitly set your calling number to one of your other numbers, you dial <desired callerid><other party>. For example, if I want to use my number 3088889099 to dial 2028089999 then I would dial 30888890992028089999. The next time I want to call 2028089999 I can simply dial that number, and ghostdial will remember to use 3088889099.

From your regular phone app, if you have a bad data connection, you can dial your own ghostdial number, and it will give you a dialtone from which you can dial as if you were in your VoIP app, but over analog! Note: This is only as secure as a regular phone call so tread carefully as if you were making a normal phone call.

On your messaging app, you can message other ghostdial servers at <phonenumber>@<otherhost> to communicate with them, and the entire stream is encrypted. You will receive voicemail from voicemail@<yourhost> and you can send SMS/MMS by sending messages to <other_number>@sms.<yourhost>

## Author
Ghostdial LLC
