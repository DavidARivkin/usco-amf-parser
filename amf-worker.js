var AMF = require("./amf.js");

self.onmessage = function( event ) {
  var data = event.data;
  data = data.data;
  
  var amf = new AMF();
  //var parsedData = 
   function callback(parsedData)
  {
    console.log("parsed data", parsedData);
    self.postMessage( {data:parsedData});//, [parsedData]);
	  self.close();
	}
  amf.load( data,callback );

  /*var vertices = result.vertices.buffer;
  self.postMessage( {vertices:vertices, normals:normals}, [vertices,normals] );*/
 
}
