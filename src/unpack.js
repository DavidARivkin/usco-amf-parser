let JSZip = require( 'jszip' )
import Rx from 'rx'


export function unpack ( data )
{
  let result = new Rx.Subject()
  try
  {
    let zip = new JSZip(data)
    for(let entryName in zip.files)
    {
      let entry = zip.files[entryName]
      if( entry._data !== null && entry !== undefined) 
      {
        let ab = entry.asArrayBuffer()
        let blob = new Blob([ab])
        let reader = new FileReader()
        reader.onload = function(e) {
            let txt = e.target.result

            result.onNext( txt )
        }
        reader.readAsText(blob)
      }
    }
  }
  catch(error){
    result.onNext( ensureString(data) )
  }

  return result
}

function ensureString (buf) {

  if (typeof buf !== "string"){
    let array_buffer = new Uint8Array(buf)
    let str = ''
    for(let i = 0; i < buf.byteLength; i++) {
      str += String.fromCharCode(array_buffer[i]) // implicitly assumes little-endian
    }
    return str
  } else {
    return buf
  }
}