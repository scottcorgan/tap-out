var types = module.exports = {
  result: require("./result"),
  assert: require("./assert"),
  test: require("./test"),
  version: require("./version"),
  plan: require("./plan"),
  is: function (type, line) {
    var localType = types[type];

    if (!localType) {
      return false;
    }

    return localType.equals(line);
  }
};
