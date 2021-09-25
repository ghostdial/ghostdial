var pipl = require('./')

var search = async () => {
  const result = await pipl.personSearch({
    addresses: [{
      country: 'RU',
	    city: 'Курган',
	    street: 'Kirov Street',
	    house: '95'
    }],
    names: [{
	    first: 'Alyona',
	    last: 'Volkova'
    }]
  });
  return result;
};
