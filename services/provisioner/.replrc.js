var voipms = require('../../libraries/voipms');
var areacodes = require('areacodes');
var usStates = new (require('usa-states'))();

var toVoipmsQuery = (query) => {
  query = query.replace(/(?:\+1|[\-])/g, '');
  const match = query.match(/(\(\w+\))/);
  let state;
  if (match) {
    const area = match[1];
    if (area.match(/^\d+$/)) {
      if (area.length === 3) {
        state = usStates.find((v) => v.state === areacodes.get(Number(area)).toUpperCase()).abbreviation;
        
      } else {
        state = usStates.find((v) => v.state === area || v.abbreviation === area).abbreviation;
      }
    }
    let type;
    const split = query.replace(/[\(\)]/g, '').match(/(?:[^\*]+|\*)/g);
    if (split[split.length - 1] !== '*') {
      type = 'endswith';
      query = split[split.length - 1];
    } else {
      split.pop();
      split.pop();
      if (split.find((v) => v === '*')) {
        type = 'contains';
        query = split[split.length - 1]
      } else {
        type = 'startswith';
        query = split[0];
      }
    }
  }
};
