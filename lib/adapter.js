var Logger = require("logging").from(__filename);
var Query = require('./query.js');
var Model = require("./model");
var Utils = require("./utils");
var mysql = require('mysql-libmysqlclient');


var ADAPTER_CLASS_NAME = 'node-ar.Adapter';

module.exports = Adapter;

function Adapter(host, user, pwd, database, port){

  var
    _db = mysql.createConnectionSync( host, user, pwd, database, port),
    _query = new Query(this),
    _models = {};


  this.__defineGetter__('__class_name__', function(){
    return Adapter.__class_name__;
  });
  this.__defineGetter__('db', function(){
    return _db;
  });

  this.__defineGetter__('query', function(){
    return _query;
  });

  this.__defineGetter__('_models', function(){
    return _models;
  });

  return this;
}


Adapter.__defineGetter__('__class_name__',function(){
  return ADAPTER_CLASS_NAME;
});


Adapter.prototype.querySelect = function(dbFields, tables, conditions){
  return this.query.querySelect( dbFields, tables, conditions ) || [];
};


Adapter.prototype.__defineGetter__('isTransActive', function(){
  return this.query.isTransActive;
});

Adapter.prototype.beginTrans = function(){
  return this.query.beginTrans();
};

Adapter.prototype.commitTrans = function(){
  return this.query.commitTrans();
};

Adapter.prototype.rollbackTrans = function(){
  return this.query.rollbackTrans();
};


Adapter.prototype.queryInsert = function(model){
  // Logger("Insert", model._table_name);
  var
    queries = [];
    saved = false,
    queryFields = {},
    dbFieldsNames = model._declared_fields;

  dbFieldsNames.forEach(function(fName){
    if ( fName != 'id' ){
      var fValue = model.formattedFieldValue( fName );
      if ( fValue ){
        queryFields[ fName ] = fValue;
      }
    }
  }, this);

  var res = this.query.queryInsert(model._table_name, queryFields);
  if ( res ){
    model._id_ = this.db.lastInsertIdSync();
    if ( model.id ){
      // Logger( 'Inserted! new id is', model.id );
    } else {
      res = false;
    }
  }

  return res;
};

Adapter.prototype.queryUpdate = function(model){

  // Logger("Update", model._table_name, model.id);
  var
    queries = [];
    saved = false,
    queryFields = {},
    dbFieldsNames = model._declared_fields;

  dbFieldsNames.forEach(function(fName){
    if ( fName != 'id' ) {
      var fValue = model.formattedFieldValue( fName );
      if ( Utils.isDefined(fValue) ){
        queryFields[ fName ] = fValue;
      }
    }
  }, this);

  var res = this.query.queryUpdate(model._table_name, queryFields, model.id);

  return res;


};


Adapter.prototype.queryDelete = function(model){
  var query = ["DELETE FROM", model._table_name, "WHERE id=" + model.id];
  return this.query._executeQuery( query.join(' ') );
};




Adapter.prototype.close = function(){
  this.db.closeSync();
  return true;
};


Adapter.prototype.modelByName = function(name){
  return this._models[ name ];
};

Adapter.prototype.migrateUp = function(){
  // Logger( "This method is not implemented yet ")
};

Adapter.prototype.migrateDown = function(){
  // Logger( "This method is not implemented yet ")
};

Adapter.prototype.declare = function(modelName, initializer){

  // Logger( "New model declaration: ", modelName);

  var model = Model.declareModel(this, modelName, initializer);

  return this._models[ model._table_name ] = model;
};