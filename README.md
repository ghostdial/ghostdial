# ghostdial

Ghostdial is the communications framework designed for Project Ghost, a project written by ghosts, for ghosts.

Ghostdial is a replacement for the worldwide phone systems we are used to. It is designed to run on a single server and consists of the following services, run on the system in parallel

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

For voice, use Zoiper Premium (Android), Linphone (Ubuntu, Mac, Windows), or Acrobits Groundwire (iOS) to connect to extension@your.host:35061 over TLS with STUN enabled and set to 157.230.88.72:3478 and audio codec set to g.711 (ulaw). Turn SRTP encryption on.

For messaging, use Conversations (Android), Gajim (Windows), Beagle IM (Mac OSX), Dino (Linux), or Siskin IM (iOS) to connect to phonenumber@your.host over XMPP with TLS and OMEMO enabled to connect to the messaging service.

On your voice app, you can operate as many numbers as you've registered from your single extension. When a call comes through, ghostdial will prepend the callerid with the phone number that the call is coming through, followed by the caller's name and number. Ghostdial will remember the number that the caller called through, and when you dial that person back, ghostdial will use the number they called to call them back. If you want to explicitly set your calling number to one of your other numbers, you dial <desired callerid><other party>. For example, if I want to use my number 3088889099 to dial 2028089999 then I would dial 30888890992028089999. The next time I want to call 2028089999 I can simply dial that number, and ghostdial will remember to use 3088889099.

On your messaging app, you can message other ghostdial servers number@other.host to communicate with them, and the entire stream is encrypted. You will receive voicemail from voicemail@your.host and you can send SMS/MMS by sending messages to number@sms.your.host


# Usage from a cellphone

You can use ghostdial even with a flip phone without mobile data. You call your own ghost number, and as soon as you hear ringing, you dial # to get to a dialtone on the internal system

You must dial your extension + your PIN + the extension you want to reach. For example, if my public number is 3055551234 and I want to reach my friend at extension 555, and if my extension is 444 and PIN is 3221, I would dial

3055551234,#,4443221555

Where the , indicates a 2s wait period. Note that on mobile phones or even many flip phones, there is an option in the dialer to add a 2s wait so you can put this comma in in your dial directly to avoid having to rush to input the tones after the call to your public number connects.

To dial using your public number to a regular phone number (let's use 3051235432 as an example) it works similarly

3055551234,#,44432213051235432

If you have multiple numbers, and you want to use a specific one, you will dial the number you want to dial out from followed by the number you want to reach. Say the number I want to use is 3051112222 and I want to reach 3051235432. I Would dial

3055551234,#,444322130511122223051235432

It is a long dial, but it works!

Everything that works from the SIP app can be accessed this way via your extension by dialing in and entering your extension and PIN first in the sequence you want to dial on the internal system.

The built-in extensions are:

```
*89 Voicemail set-up / Change PIN
*69 Dial last caller to your extension
*9 Register the calling phone to be the phone that receives calls if your SIP line cannot be reached, it will hang up on you if it worked
*97576281313 Forward calls to 7576281313 from now on
*90 Clear forwarding rule and only take calls via SIP or voicemail

```

You can save your own set of extensions too:
```
*#133#75762813137575548198 // from now on you can dial 133 to use the number 7576281313 to dial 7575548198

*#133# // erase extension
```

## Author
Ghostdial LLC
