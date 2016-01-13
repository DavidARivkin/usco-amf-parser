export function parseText( value, toType , defaultValue)
{
  defaultValue = defaultValue || null

  if( value !== null && value !== undefined )
  {
    switch(toType)
    {
      case "float":
        value = parseFloat(value)
      break
      case "int":
        value = parseInt(value)
      break
      //default:
    }
  }
  else if (defaultValue !== null)
  {
    value = defaultValue
  }
  return value
}

export function parseColor( node , defaultValue)
{
  let color = defaultValue || null //let color = volumeColor !== null ? volumeColor : new THREE.Color("#ffffff")

  let r = parseText( node.r.value , "float",1.0)
  let g = parseText( node.g.value , "float", 1.0)
  let b = parseText( node.b.value , "float", 1.0)
  let a = ("a" in node) ? parseText( node.a.value , "float", 1.0) : 1.0
  let color = [r,g,b,a]
  return color
}

export function parseVector3( node, prefix, defaultValue )
{
  let coords = null
  let prefix =  prefix || "" 
  let defaultValue = defaultValue || 0.0

  let x = (prefix+"x" in node) ? parseText( node[prefix+"x"].value, "float" , defaultValue) : defaultValue
  let y = (prefix+"y" in node) ? parseText( node[prefix+"y"].value, "float" , defaultValue) : defaultValue
  let z = (prefix+"z" in node) ? parseText( node[prefix+"z"].value, "float" , defaultValue) : defaultValue

  let coords = [x,y,z]
  return coords
}

export function parseMapCoords( node, prefix, defaultValue)
{
  //console.log("parsing map coords", node, ("btexid" in node) , node.btexid)
  //get vertex UVs (optional)
  //rtexid, gtexid, btexid
  
  let rtexid = ("rtexid" in node) ? parseText( node["rtexid"], "int" , null) : null
  let gtexid = ("gtexid" in node) ? parseText( node["gtexid"], "int" , defaultValue) : null
  let btexid = ("btexid" in node) ? parseText( node["btexid"], "int" , defaultValue) : null

  let u1 = ("u1" in node) ? parseText( node["u1"].value, "float" , defaultValue) : null
  let u2 = ("u2" in node) ? parseText( node["u2"].value, "float" , defaultValue) : null
  let u3 = ("u3" in node) ? parseText( node["u3"].value, "float" , defaultValue) : null

  let v1 = ("v1" in node) ? parseText( node["v1"].value, "float" , defaultValue) : null
  let v2 = ("v2" in node) ? parseText( node["v2"].value, "float" , defaultValue) : null
  let v3 = ("v3" in node) ? parseText( node["v3"].value, "float" , defaultValue) : null

  //console.log("textures ids", rtexid,gtexid,btexid,"coords", u1,u2,u3,"/", v1,v2,v3)
  //face.materialIndex  = rtexid
  //face.materialIndex  = 0

  let uv1 = (u1 !== null && v1 !=null) ? [u1,v1] : null
  let uv2 = (u2 !== null && v2 !=null) ? [u2,v2] : null 
  let uv3 = (u3 !== null && v3 !=null) ? [u3,v3] : null
  
  let mappingData = {matId:0, uvs:[uv1,uv2,uv3]}
  //currentGeometry.faceVertexUvs[ 0 ].push( [uv1,uv2,uv3])
  return mappingData
}

function parseExpression( expr)
{//This is for "maths" expression for materials, colors etc :TODO: implement

}

export function parseTexture ( textureData ){
  let rawImg = textureData.imgData
  //'data:image/pngbase64,'+
  /*Spec says  : 
  The data will be encoded string of bytes in Base64 encoding, as grayscale values.
  Grayscale will be encoded as a string of individual bytes, one per pixel, 
  specifying the grayscale level in the 0-255 range : 
  how to handle grayscale combos?*/
  //Since textures are grayscale, and one per channel (r,g,b), we need to combine all three to get data

  /*rawImg = 'iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAAB90RVh0U29mdHdhcmUATWFjcm9tZWRpYSBGaXJld29ya3MgOLVo0ngAAAAWdEVYdENyZWF0aW9uIFRpbWUAMDUvMjgvMTGdjbKfAAABwklEQVQ4jdXUsWrjQBCA4X+11spikXAEUWdSuUjh5goXx1V5snu4kMLgyoEUgYNDhUHGsiNbCK200hWXFI7iOIEUd9Mu87E7MzsC6PjCcL4S+z/AwXuHQgg8T6GUi+MI2rbDmJqqMnTd26U/CXqeRxD4aO2ilIOUAms7jGkpipr9vqSqqo+BnudxcaEZjRRx7DIeK7SWFIUlSQxpKhkMHLZbemgPFEIQBD6jkeL62mc2u2QyuSIMA/J8z+Pjb+bzNQ8P0DTtedDzFFq7xLHLbHbJzc0PptPv+H5EWWYsl3fALZvNirK05LnCGHMaVOpvzcZjxWRy9Yx9A2J8P2U6hSRJuL/fsFoZhsNjsDc2jiOQUqC1JAwDfD8CYkA/oxFhGKC1REqB44jj/Ndg23ZY21EUljzfU5YZkAIFkFKWGXm+pygs1nbUdXOUL4Gfr5vi+wohBFFk0VoQRQNcN6Msf7Fc3rFYLFksnsiymu22oG3b0zWsKkNR1KSpZD5fA7ckSdLrcprWHA6Gpjm+oeCNbXN+Dmt2O8N6/YS19jz4gp76KYeDYbc79LB3wZdQSjEcKhxHUNcNVVX3nvkp8LPx7+/DP92w3rYV8ocfAAAAAElFTkSuQmCC'*/

  if(detectEnv.isNode)
  {
    function btoa(str) {
      let buffer
      if (str instanceof Buffer) {
        buffer = str
      } else {
        buffer = new Buffer(str.toString(), 'binary')
      }
      return buffer.toString('base64')
    }
    rawImg = btoa(rawImg)
  }
  else
  {
    rawImg = btoa(rawImg)
    /*let image = document.createElement( 'img' )
    image.src = rawImg
    let texture = new THREE.Texture( image )*/
  }
  /*let texture = new THREE.DataTexture( rawImg, parseText(textureData.width,"int",256) , parseText(textureData.height,"int",256), THREE.RGBAFormat )
  texture.needsUpdate = true*/
  
  let id = textureData.id
  let type = textureData.type
  let tiling= textureData.tiled
  let depth = parseText(textureData.depth,"int",1) 
  
  console.log("texture data", id, type, tiling,depth )
  return textureData
}