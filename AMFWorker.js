importScripts( "lzma.js", "amf.js" );

self.onmessage = function( event ) {

        var files = [];

        for ( var i = 0; i < event.data.offsets.length; i ++ ) {

                var stream = new AMF.Stream( event.data.data );
                stream.offset = event.data.offsets[ i ];

                files[ i ] = new AMF.File( stream );

        }

        self.postMessage( files );
        self.close();

}
