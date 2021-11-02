var exports = module.exports = function (line) {
  
  var m = line
    .split(' ')
    .filter(function (item) {
      
      // Remove blank spaces
      return item !== '';
    });
  
  return {
    type: 'result',
    raw: line,
    name: m[1],
    count: m[2]
  };
};

exports.equals = function (line) {
  
  var p = new RegExp('#\\s+(tests|pass|fail|todo)\\s+\\d+\\s*$',['i']);
  
  return p.test(line);
};