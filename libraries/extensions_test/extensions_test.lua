dofile("/etc/asterisk/extensions.lua");

local channel_class = {};
channel_class.mt = {
  __newindex = function (self, k, v)
    self._vars[k] = v;
  end,
  __index = function (self, k)
    local _self = self;
    return { get = function (self, k) return _self._vars[k]; end };
  end
}

setmetatable(channel_class, { __index = channel_class });

function channel_class:new(o)
  local instance = {};
  setmetatable(instance, channel_class.mt);
  instance.mt = channel_class.mt;
  instance._vars = {
    ['CALLLERID(num)'] = o['CALLERID(num)'] or '7576362081',
    ['CALLERID(name)'] = o['CALLERID(name)'] or 'flex',
    ['SIPUSER'] = o['SIPUSER'] or '555',
    ['SIPDOMAIN'] = o['SIPDOMAIN'] or 'stomp.dynv6.net',
    ['CALLERID(all)'] = o['CALLERID(all)'] or '"flex" <555>'
  };
  return instance;
end

function handle_app_call(name, ...)
  table.insert(channel._appcalls, { name, ... });
end

local next_dialstatus = 'SUCCESS';

function set_next_dialstatus(status)
  next_dialstatus = status;
end

function extension_digit_to_pattern(digit)
  if digit == 'X' then
    return "%d";
  end
  if digit == 'N' then
    return '[1-9]';
  end
  if digit == '.' then
    return '.*$';
  end
  return digit;
end

function extension_to_pattern(extension)
  local pattern = '';
  if extension[0] == '_' then
    for c in extension:sub(1):gmatch('.') do
      pattern = pattern .. extension_digit_to_pattern(c);
    end
  end
  return pattern;
end

function sort_extensions(group)
  local retval = { match = {}, explicit = {} };
  for k, v in ipairs(group) do
    if k == 'i' then
      retval.invalid = v;
    elseif k[0] == '_' then
      retval.match[k] = v;
    else
      retval.explicit[k] = v;
    end
  end
end

function no_match(context, extension)
  return function (...)
      channel.NO_MATCH = { context, extension };
    end
end

function match_handler(context, extension)
  local group = extensions[context];
  if not group then return no_match(context, extension); end
  local sorted = sort_extensions(group);
  if sorted.explicit[extension] then return sorted.explicit[extension]; end
  for k, v in ipairs(sorted.match) do
    if extension:find(extension_to_pattern(k)) then
      return v
    end
  end
  if not sorted.invalid then
    return no_match(context, extension);
  end
end

_G.app = {
  dial = function (...)
    handle_app_call('dial', ...);
    channel._vars.DIALSTATUS = next_dialstatus;
  end,
  ["goto"] = function (context, extension)
    local handler = match_handler(context, extension);
    return handler(context, extension);
  end,
  verbose = function (v)
    print(v);
  end
};
    
setmetatable(_G.app, {
  __index = function (self, k)
    return function (...)
      handle_app_call(k, ...);
    end
  end
});

function test_dial(context, extension, o)
  _G.channel = channel_class:new(o);
  app["goto"](context, extension);
  return _G.channel;
end

