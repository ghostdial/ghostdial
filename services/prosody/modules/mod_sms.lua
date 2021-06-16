prosody.unlock_globals();
local redis = require 'redis';
local st = require 'util.stanza';
local jid_split = require 'util.jid'.split;
local json = require 'util.json';

local connection = redis.connect('127.0.0.1', 6379)

local timer = require 'util.timer';
local config_get = require "core.configmanager".get;
local uuid = require 'util.uuid';
local datamanager = require "util.datamanager";
local serialize = require "util.serialization".serialize;
local pairs, ipairs = pairs, ipairs;
local setmetatable = setmetatable;
local rostermanager = require 'core.rostermanager';

function jid_to_components(jid)
  local node, host, resource = jid_split(jid);
  return { full = node .. '@' .. host, node = node, host = host, resource = resource };
end

function subscribe_one_way(from_jid, to_jid)
  local from, to = jid_to_components(from_jid), jid_to_components(to_jid);
  rostermanager.set_contact_pending_out(from.node, from.host, to.full);
  rostermanager.set_contact_pending_in(to.node, to.host, from.full);
  rostermanager.subscribed(to.node, to.host, from.full);
  rostermanager.process_inbound_subscription_approval(from.node, from.host, to.full);
end

function subscribe(from, to)
  subscribe_one_way(from, to);
  subscribe_one_way(to, from);
end

local component_host = module:get_host();
local component_name = module.name;
local data_cache = {};

if module:get_host_type() ~= "component" then
	error(module.name.." should be loaded as a component, check out http://prosody.im/doc/components", 0);
end

function debug_print(msg, annotation, transform)
  transform = transform or function (v) return v; end;
  module:log('info', (annotation and (annotation .. ': ') or '') .. (transform(msg) or ''));
  return msg;
end

local users = {};
local smsuser = {};
smsuser.__index = smsuser;
setmetatable(users, { __index =	function (table, key)
  return smsuser:register(key);
end });

-- Create a new smsuser object
function smsuser:new()
  newuser = {};
  setmetatable(newuser, self);
  return newuser;
end

function smsuser:register(bjid)
	reguser = smsuser:new();
	reguser.jid = bjid;
	reguser.data = datamanager.load(bjid, component_host, "data") or { roster= {} };
	users[bjid] = reguser;
	return reguser;
end

function smsuser:initialize(bjid)
	local user = smsuser:register(bjid);
	user:store();
end

-- Store (save) the user object
function smsuser:store()
	datamanager.store(self.jid, component_host, "data", self.data);
end

-- For debug
function smsuser:logjid()
	module:log("logjid: ", self.jid);
end

function smsuser:roster_add(sms_number)
	if self.data.roster == nil then
		self.data.roster = {}
	end
	if self.data.roster[sms_number] == nil then
		self.data.roster[sms_number] = {screen_name=sms_number, subscription='subscribed'};
	end
	self:store();
	return self;
end

-- Update the roster entry of sms_number with new screen name
function smsuser:roster_update_screen_name(sms_number, screen_name)
	self.data.roster = self.data.roster or {};
	if self.data.roster[sms_number] == nil then
		smsuser:roster_add(sms_number);
	end
	self.data.roster[sms_number].screen_name = screen_name;
	self:store();
end

-- Update the roster entry of sms_number with new subscription detail
function smsuser:roster_update_subscription(sms_number, subscription)
	if self.data.roster[sms_number] == nil then
		smsuser:roster_add(sms_number);
	end
	self.data.roster[sms_number].subscription = subscription;
	self:store();
end

-- Delete an entry from the roster
function smsuser:roster_delete(sms_number)
	self.data.roster[sms_number] = nil;
	self:store();
end

--
function smsuser:roster_stanza_args(sms_number)
	if self.data.roster[sms_number] == nil then
		return nil
	end
	local args = {jid=sms_number.."@"..component_host, name=self.data.roster[sms_number].screen_name}
	if self.data.roster[sms_number].subscription ~= nil then
		args.subscription = self.data.roster[sms_number].subscription
	end
	return args
end


function tick()
  local data = connection:lpop('sms-in');
  if (data ~= nil) then
    handle_message(data);
    tick();
  else
    timer.add_task(1, function ()
      tick()
    end);
  end
end
  

function handle_message(msg)
  local decoded = json.decode(tostring(msg));
  local from_jid = decoded.from .. '@' .. module:get_host();
  users[from_jid]:roster_add(decoded.to);
  stz = sms_to_stanzas(decoded);
  for _, s in ipairs(stz) do
    module:send(s);
  end
end

function iq_disco_info(stanza)
    module:log("info", "Disco info triggered");
    local from = {};
    from.node, from.host, from.resource = jid_split(stanza.attr.from);
    local bjid = from.node.."@"..from.host;
    local reply = data_cache.disco_info;
    if reply == nil then
      reply = st.reply(stanza):query("http://jabber.org/protocol/disco#info");
      reply:tag("identity", {category='gateway', type='sms', name=component_name}):up();
      reply:tag("feature", {var="urn:xmpp:receipts"}):up();
      reply:tag("feature", {var="jabber:iq:register"}):up();
      reply:tag("feature", {var="http://jabber.org/protocol/rosterx"}):up();
      reply = reply:tag("feature", {var="http://jabber.org/protocol/commands"}):up();
      reply = reply:tag("feature", {var="jabber:iq:time"}):up();
      reply = reply:tag("feature", {var="jabber:iq:version"}):up();
--[[      reply = reply:tag('feature', {var="http://jabber.org/protocol/chatstates" }); ]]
      data_cache.disco_info = reply;
    end
    reply.attr.id = stanza.attr.id;
    reply.attr.to = stanza.attr.from;
    return reply;
end

function iq_roster_push(origin, stanza)
	module:log("info", "Sending Roster iq");
	local from = {}
	from.node, from.host, from.resource = jid_split(stanza.attr.from);
	local from_bjid = nil;
	if from.node ~= nil and from.host ~= nil then
		from_bjid = from.node.."@"..from.host;
	elseif from.host ~= nil then
		from_bjid = from.host;
	end
	reply = st.iq({to=stanza.attr.from, id=stanza.attr.id or uuid.generate(), type='set'});
	reply:tag("query", {xmlns="jabber:iq:roster"});
	if users[from_bjid].data.roster ~= nil then
		for sms_number, sms_data in pairs(users[from_bjid].data.roster) do
			reply:tag("item", users[from_bjid]:roster_stanza_args(sms_number)):up();
		end
	end
	origin.send(reply);
end

function presence_stanza_handler(origin, stanza)
	module:log("info", "Presence handler triggered");
	module:log('info', stanza:pretty_print());
	local to = {};
	local from = {};
	local pres = {};
	to.node, to.host, to.resource = jid_split(stanza.attr.to);
	from.node, from.host, from.resource = jid_split(stanza.attr.from);
	pres.type = stanza.attr.type;
	for _, tag in ipairs(stanza.tags) do pres[tag.name] = tag[1]; end
	local from_bjid = nil;
	if from.node ~= nil and from.host ~= nil then
		from_bjid = from.node.."@"..from.host;
	elseif from.host ~= nil then
		from_bjid = from.host;
	end
	local to_bjid = nil
	if to.node ~= nil and to.host ~= nil then
		to_bjid = to.node.."@"..to.host
	end
	module:log('info', from_bjid);
	module:log('info', to_bjid);
	module:log('info', json.encode(to));
	module:log('info', json.encode(from));

		-- The component itself is online, so send component's presence

		-- Do roster item exchange: send roster items to client
		-- SMS user presence
	if not users[to.node] then
		users[to.node] = smsuser:register(from.node);
	end
	if pres.type == 'subscribe' then
			module:log('info', 'sms user subscribe');
			if not (users[to.node].data.roster or {})[from.node] then
				users[to.node]:roster_add(from_bjid, 'subscribed');
				iq_roster_push(origin, stanza);
			       module:log('info', 'registered added and subscribed');
			end
			--subscribe_one_way(to_bjid, from_bjid);
			module:log('info', 'sending user presence');
			origin.send(st.presence({to=from_bjid, from=component_host, type="subscribed" }));
			origin.send(st.presence({to=from_bjid, from=to_bjid}));

		end
		if pres.type == 'unsubscribe' then
			users[to.node]:roster_update_subscription(from_bjid, 'none');
			iq_roster_push(origin, stanza);
			origin.send(st.presence({to=from_bjid, from=to_bjid, type='unsubscribed'}));
			users[from_bjid]:roster_delete(to.node)
	end
	if users[from_bjid].data.roster[to.node] then
		origin.send(st.presence({to=from_bjid, from=to_bjid}));
	end
	return true;
	end

function sms_event_handler(event)
  module:log('info', tostring(event.stanza));
  local found = string.find(module:get_host(), select(2, jid_split(event.stanza.attr.from)) or '');
  if found then
    local node, host = jid_split(event.stanza.attr.from);
    local bjid = node .. '@' .. host;
    module:log('info', 'initializing: ' .. bjid);
    smsuser:initialize(bjid);
  end
  local stanza, origin = event.stanza, event.origin;
  module:log("debug", "Received stanza: "..stanza:pretty_print());
  local to_node, to_host, to_resource = jid_split(stanza.attr.to);
  if to_node == nil then
    local type = stanza.attr.type;
    if type == "error" or type == "result" then return; end
    if stanza.name == "presence" then
      presence_stanza_handler(origin, stanza);
    end
  end
end

function iq_handle(event)
        local origin, stanza = event.origin, event.stanza;
	module:log("info", "Received stanza: "..stanza:pretty_print());
	local to_node, to_host, to_resource = jid_split(stanza.attr.to);

	-- Handle component internals (stanzas directed to component host, mainly iq stanzas)
	if to_node == nil then
	 	local type = stanza.attr.type;
		if type == "error" or type == "result" then return; end
		if stanza.name == "presence" then
			presence_stanza_handler(origin, stanza);
		end
		if stanza.name == "iq" and type == "get" then
			local xmlns = stanza.tags[1].attr.xmlns
			if xmlns == "http://jabber.org/protocol/disco#info" then
				origin.send(iq_disco_info(stanza));
				return true;
			--[[
			elseif xmlns == "http://jabber.org/protocol/disco#items" then
				origin.send(iq_disco_items(stanza));
				return true;
			--]]
			elseif xmlns == "jabber:iq:register" then
				iq_register(origin, stanza);
				return true;
			end
		elseif stanza.name == "iq" and type == "set" then
			local xmlns = stanza.tags[1].attr.xmlns
			if xmlns == "jabber:iq:roster" then
				origin.send(iq_roster(stanza));
			elseif xmlns == "jabber:iq:register" then
				iq_register(origin, stanza);
				return true;
			end
		end
	end
end

function presence_handle(event)
  local origin, stanza = event.origin, event.stanza;
  presence_stanza_handler(origin, stanza);
end

function message_handle(event)
  local stanza, origin = event.stanza, event.origin;
  message_stanza_handler(event);
end

function confirm_message_delivery(event)
	local reply = st.message({ type='chat', from=event.stanza.attr.to, to=event.stanza.attr.from or component_host, id=uuid.generate() }):tag('received', { id=event.stanza.attr.id, xmlns = "urn:xmpp:receipts" }):up();
	module:log('info', tostring(reply));
	event.origin.send(reply);
	return true;
end

function message_stanza_handler(event)
  local stanza, origin = event.stanza, event.origin;
  local to = {};
  local from = {};
  local msg = {};
  to.node, to.host, to.resource = jid_split(stanza.attr.to);
  from.node, from.host, from.resource = jid_split(stanza.attr.from);
  local bjid = nil;
  if from.node ~= nil and from.host ~= nil then
    from_bjid = from.node.."@"..from.host;
  elseif from.host ~= nil then
    from_bjid = from.host;
  end
  local to_bjid = nil;
  if to.node ~= nil and to.host ~= nil then
    to_bjid = to.node.."@"..to.host;
  elseif to.host ~= nil then
    to_bjid = to.host;
  end
  local body = stanza:get_child('body');
  local msg = {
    body = (body and body:get_text()),
    x = stanza:get_child('x'),
    request_receipt = stanza:get_child('request', 'urn:xmpp:receipts')
  };
  if msg.request_receipt then
    module:log('info', 'confirming message delivery');
    confirm_message_delivery(event);
  end
  --[[
  if stanza.attr.to == component_host then
    origin.send(st.message({to=stanza.attr.from, from=component_host, type='chat'}):tag("body"):text(msg.body):up());
  ]]
  local attachments, message = {}, '';
  if msg.body or msg.x then
    if msg.x then
      attachments = { msg.x:get_text() };
    else
      message = msg.body;
    end
    on_message({ from=from.node, to=to.node, message=message, attachments=attachments });
  end
  return true;
end
function on_message(sms)
  local sms = json.encode(sms);
  local ok, err = connection:rpush('sms-out', sms);
end

function sms_from_stanza(stanza)
  local to = jid_split(stanza.attr.to);
  local from = jid_split(stanza.attr.from);
  local message = stanza:find('body'):get_text();
  return { to=to, from=from, message=message };
end

function sms_to_stanzas(sms)
  local result = {};
  for _, attachment in ipairs(sms.attachments or {}) do
    table.insert(result, st.message({ from=sms.from .. '@' .. component_host, to=sms.to .. '@stomp.dynv6.net', type='chat'  }):tag('active', { xmlns="http://jabber.org/protocol/chatstates" }):up():tag('body'):text(attachment):up():tag('x', { xmlns="jabber:x:oob" }):tag('url'):text(attachment):up():up());
  end
  if sms.message ~= '' then table.insert(result, st.message({ from=(sms['from'] .. '@sms.stomp.dynv6.net'), to=(sms['to'] .. '@stomp.dynv6.net'), type='chat' }):tag('active', { xmlns = 'http://jabber.org/protocol/chatstates' }):up():tag('body'):text(sms.message)) end
  return result;
end

module:add_feature("http://jabber.org/protocol/disco#info");
module:add_feature("http://jabber.org/protocol/disco#items");
--module:add_feature("urn:xmpp:receipts");
--module:add_feature('http://jabber.org/protocol/chatstates');

module:hook("iq/bare", iq_handle);
module:hook("message/bare", message_handle);
module:hook("presence/bare", presence_handle);
module:hook("iq/full", iq_handle);
module:hook("message/full", message_handle);
module:hook("presence/full", presence_handle);
module:hook("iq/host", iq_handle);
module:hook("message/host", message_handle);
module:hook("presence/host", presence_handle);

tick();
