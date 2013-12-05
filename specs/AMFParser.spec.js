AMFParser = require("../AMFParser")
THREE = require("THREE")

describe("AMF parser tests", function() {
  var parser = new AMFParser();

  it("can parse uncompressed amf files", function() {

    data = "";
    parser.parse(data);
    expect(data).toBe(true);
  });
});
