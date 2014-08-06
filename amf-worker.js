//importScripts('./stl-utils.js');
//var amfUtils = require("./amf-utils.js");
var AMF = require("./amf.js");

self.onmessage = function( event ) {
  var data = event.data;
  data = data.data;
  
  var amf = new AMF();
  data = amf.load( data );

  /*var vertices = result.vertices.buffer;
  var normals =  result.normals.buffer;
  self.postMessage( {vertices:vertices, normals:normals}, [vertices,normals] );*/
  self.postMessage( {data:data});
	self.close();
}
