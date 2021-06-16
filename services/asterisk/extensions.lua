extensions = {}

require 'socket';
local https = require 'ssl.https';
local json = require 'json';
local ltn12 = require 'ltn12';
local redis = require 'redis';

local lua_print = print;

function to_host_and_port(uri)
  local it = string.gmatch(uri, "(^[^:*]):(%d*)$");
  return it(), it();
end

local cache = redis.connect(to_host_and_port(select(1, os.getenv("REDIS_HOST")) or '127.0.0.1:6379'));

local registry = os.getenv("REGISTRY_URI") or 'https://localhost:3050';

local print = function (msg)
  app.verbose(msg);
end

function data247_carriertype(num)
  local response = {};
  local err, status = https.request({
    method="POST",
    url='https://api.data247.com/v3.0?key=' .. os.getenv('DATA247_API_KEY') .. '&api=CU&out=json&phone=' .. num .. '&addfields=type,last_port_date',
    sink=ltn12.sink.table(response)
  });
  return status ~= 200, status == 200 and json.decode(response[1]).response.results[1].type;
end

--[[
function is_voip(num)
  return false;
  local err, result = data247_carriertype(num);
  if (err) then
    return true;
  else
    return result == 'V';
  end
end
]]

function is_voip(num)
  return false;
end

function is_blacklisted(channel, from)
  return (cache:get('blacklist.' .. from) or cache:get('blacklist.sipuser:' .. channel.sipuser:get() .. '.' .. from) or cache:get('blacklist.sipuser:' .. channel.sipuser:get() .. '.did:' .. channel.did:get() .. '.' .. from));
end

function dial(...)
  app.dial(...);
  return channel.DIALSTATUS:get();
end

local did_to_box = {};

function link_voicemail(box, did)
  did_to_box[did] = box;
end

function set_callerid(channel, callerid)
  print('Setting CALLERID(num) to ' .. callerid);
  channel['CALLERID(num)'] = callerid;
end

function write_voicemail_did(channel, msg_filepath)
  local filepath = msg_filepath .. '.did.txt';
  local file = io.open(filepath, 'w');
  file:write(channel.extension:get());
  file:close();
end

function send_to_voicemail(channel, number)
  if #number < 10 then
    app.voicemail(number, 'u')
  else
    app.voicemail(did_to_box[channel.did:get()], 'u');
  end
  write_voicemail_did(channel, channel.VM_MESSAGEFILE:get() or '');
  app.hangup();
end

function compute_last_cid_key(sipuser, number)
  return 'last-cid.' .. sipuser .. '.' .. number;
end

function get_last_cid(channel, number)
  return cache:get(compute_last_cid_key(channel.sipuser:get(), number));
end

function set_last_cid(channel, number, did)
  cache:set(compute_last_cid_key(channel.sipuser:get(), number), did);
end

function dial_outbound(channel, number)
  number = string.gsub(number, '+', '')
  if #number >= 20 then
    channel.override = number:sub(0, 10);
    if did_to_ext[channel.override:get()] ~= channel.sipuser:get() then
      return app.hangup();
    end
    set_last_cid(channel, number, channel.override:get());
    return dial_outbound(channel, number:sub(11));
  end
  number = #number == 10 and ('1' .. number) or number;
  local outbound = cache:get('outbound.' .. ((channel.override and channel.override:get()) or channel.did:get())) or 'voipms';
  if not channel.immutable_callerid:get() then set_callerid(channel, channel.override and channel.override:get() or get_last_cid(channel, number) or channel.did:get()); end;
  if extensions.inbound[number] then return extensions.inbound[number](context, number); end
  local response = {};
  local ok, status = https.request({
    url= registry .. '/resolve',
    method= 'POST',
    sink= ltn12.sink.table(response)
  }, json.encode({
    number=number
  }));
  local host = json.decode(response.response);
  if not ok or status ~= 200 or host.status ~= 'success' then
    return dial('IAX2/' .. outbound .. '/' .. number);
  end
  return dial('SIP/' .. channel['CALLERID(num)']:get() .. ':ghostdial@' .. host.result .. ':35061/' .. number);
end
 
function hit_em_wit_jg_real_quick(channel)
  local sipuser = channel.sipuser:get();
  if sipuser ~= "101" and sipuser ~= "555" then
    if #channel.callerid_num:get() == 10 then 
      channel.immutable_callerid = '1';
    end
    return dial_outbound(channel, '18772274669');
  else
    send_to_voicemail(channel, sipuser);
  end
end

function dialsip(channel, to, on_failure)
  print(channel.callerid_num:get());
  local voip = is_voip(channel.callerid_num:get())
  if not is_blacklisted(channel, channel.callerid_num:get()) and not is_voip(channel.callerid_num:get())  then
    local status = dial('SIP/' .. to, 30);
    if status == "CHANUNAVAIL" or status == "BUSY" or status == "CONGESTED" then
      return send_to_voicemail(channel, to)
    else
      return app.hangup();
    end
  else
    hit_em_wit_jg_real_quick(channel);
  end
end

extensions.inbound = {};
extensions.default = {};

function inbound_dial(did, ext, real_number)
  local local_ctx = ext .. '-context';
  extensions[local_ctx] = {
    ["_X."] = function (context, extension)
      channel.did = did;
      channel.sipuser = ext;
      channel.callerid_num = channel['CALLERID(num)']:get();
      channel.callerid_name = channel['CALLERID(name)']:get();
      channel.extension = extension;
      print('OUTGOING CALL from ' .. ext .. ' to ' .. extension);
      if (hooks[ext] or {})[extension] then
        return hooks[ext][extension](channel);
      elseif #extension < 10 then
        dialsip(channel, extension);
      else
        dial_outbound(channel, extension);
      end
    end
  }; 
  extensions.inbound[did] = function (context, extension)
    channel.callerid_num = channel['CALLERID(num)']:get();
    channel.callerid_name = channel['CALLERID(name)']:get();
    channel.extension = extension;
    channel.did = did;
    channel.sipuser = ext;
    print("INBOUND CALL from " .. channel['CALLERID(all)']:get())
    print("DEST: " .. channel.sipuser:get() .. " " .. channel.did:get());
    if channel.callerid_num:get() == real_number then
      return app.disa('no-password', channel.sipuser:get() .. '-context');
    end
    set_last_cid(channel, channel.callerid_num:get(), did);
    channel['CALLERID(name)'] = did .. ': ' .. channel['CALLERID(name)']:get();
    return dialsip(channel, ext);
  end 
  extensions.default[did] = external_handler;
end

function external_handler(context, extension)
    if not extensions.inbound[extension] then return; end
    print('EXTERNAL CALL FROM ' .. channel['SIPDOMAIN']:get());
    channel.sipdomain = channel['SIPDOMAIN']:get();
    channel['CALLERID(num)'] = channel['SIPUSER']:get();
    return extensions.inbound[extension](context, extension);
end


did_to_ext = {};

users = {
  { "4757772244", "555", "7576362081" },
  { "5098509090", "666", "5092957376" },
  { "3055633233", "420", "5083336704" },
  { "8603187999", "123", "8604949393" },
  { "3259997770", "555", "7576362081" },
  { "8603187796", "606", "8609178606" },
  { "8603187799", "606", "8609178606" },
  { "8603187798", "339", "7576355339" },
  { "8603187800", "183", "8609172183" },
  { "4012342344", "555", "7576362081" },
  { "4015155222", "555", "7576362081" },
  { "4013664448", "555", "7576362081" },
  { "3077353900", "555", "7576362081" },
  { "3259997779", "555", "7576362081" },
  { "3078864700", "555", "7576362081" },
  { "4015940045", "101", "8603729858" },
  { "4015940050", "101", "8603729858" },
  { "4019006777", "234", "2347031816621" }
};

for k, v in ipairs(users) do
  inbound_dial(v[1], v[2], v[3]);
  did_to_ext[v[1]] = v[2];
  link_voicemail(v[2], v[1]);
end

function send_to_zero_call(channel)
  set_callerid(channel, channel.did:get());
  local outbound = cache:get('outbound.' .. ((channel.override and channel.override:get()) or channel.did:get())) or 'voipms';
  return dial('IAX2/' .. outbound .. '/14139311587,,D(767665032#)');
end

hooks = {
  ["555"] = {
    ["990"] = function (context, extension) send_to_zero_call(channel); end
  },
  ["420"] = {
    ["990"] = function (context, extension) send_to_zero_call(channel); end
  }
};

sip = {
  general = {
    transport="udp",
    bind="0.0.0.0",
    bindport="35060",
    tlsbindaddr="0.0.0.0:35061",
    tlsenable="yes",
    tlscertfile="/etc/asterisk/keys/stomp.dynv6.net.crt",
    tlscafile="/etc/asterisk/keys/ca.crt",
    tlsprivatekey="/etc/asterisk/keys/stomp.dynv6.net.key",
    srvlookup="yes",
    qualify="no",
    disallow="all",
    allow="ulaw",
    allow="g729",
    allow="gsm",
    allow="alaw",
    allow="t140",
    textsupport="yes"
  }
};

function create_sip_account(extension, password)
  sip[extension] = {
    type="friend",
    transport="udp,tls",
    encryption="yes",
    carevite="no",
    host="dynamic",
    defaultuser=extension,
    nat="force_rport,comedia",
    secret=password
  };
end

extensions.inbound["4012092999"] = function (context, extension)
  channel['CALLERID(name)'] = "MUSHKI: " .. channel['CALLERID(name)']:get();
  local status = dial("SIP/555&SIP/101");
  if status ~= 'SUCCESS' then
    send_to_voicemail(channel, 999);
  end
end

did_to_ext["4012092999"] = "555";

function write_sip_accounts()
  local file = io.open('/etc/asterisk/sip.conf', 'w');
  for k, v in ipairs(sip) do
    file.write('[' .. k .. ']\n');
    for vk, vv in ipairs(v) do
      file.write(vk .. '=' .. vv .. '\n');
    end
  end
end
