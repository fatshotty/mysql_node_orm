var Logger = require("logging").from(__filename);


  /* Utility functions */

module.exports.isDefined = function( value ){
  return typeof value != 'undefined' && typeof value != 'null';
}

module.exports.extendMethods = function(proto, methods){


  var methodNames = Object.keys( methods );

  methodNames.forEach(function(methodName){

    if ( proto[ methodName ] ){

      var _old = proto[ methodName ];
      proto[ methodName ] = function(){
        this._super = _old;
        var res = methods[ methodName ].apply( this, arguments );
        this._super = null;
        return res;
      };

    } else {
      proto[ methodName ] = methods[ methodName ];
    }

  });


  return proto;
}