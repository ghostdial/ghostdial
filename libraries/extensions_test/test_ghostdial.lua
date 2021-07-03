local luaunit = require 'luaunit'
dofile('./extensions_test.lua');
local json = require 'json';

function test_extension_to_pattern()
  local pattern = extension_to_pattern("_X.");
  print(pattern);
end

function test_data247(number)
  local err, result = data247_carriertype('8603729858');
  luaunit.assertEquals(result, 'M');
end

function test_incoming_to_did()
  local channel = mock_dial('555-context', '8603729858', {
    ["CALLERID(num)"] = 'flex',
    ["CALLERID(all)"] = '"flex" <555>',
    ['SIPUSER'] = "555",
    ['SIPDOMAIN'] = 'ghostdial.net'
  });
  print(json.encode(channel._vars))
end

os.exit(luaunit.LuaUnit.run());
