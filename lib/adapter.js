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

/* -------------
 * Static field
 * ------------- */

Adapter.__defineGetter__('__class_name__',function(){
  return ADAPTER_CLASS_NAME;
});


/* ----------------
 * Instance fields
 * ---------------- */

/**
 *  Returns the internal class name
 */
Adapter.prototype.__defineGetter__('__class_name__', function(){
  return Adapter.__class_name__;
});

/**
 *  Returns the state of the transaction
 */
Adapter.prototype.__defineGetter__('isTransActive', function(){
  return this.query.isTransActive;
});


/* --------
 * Instance methods
 * -------- */


/**
 *  This methods performs a 'SELECT' like query and returns the recordset
 *
 *  @param dbFields (Object) like { table_foo_name: [ 'field_foo_name', 'field_bar_name'] }
 *  @param tables (Array) like [ 'table_bar_name', 'other_table_name' ]
 *  @param conditions (Obejct) like { where: {}, joins: { ... } }
 *
 *  @return a parsed recordset data
 */
Adapter.prototype.querySelect = function(dbFields, tables, conditions){
  return this.query.querySelect( dbFields, tables, conditions ) || [];
};


/**
 *  Begins the transaction and return its result
 */
Adapter.prototype.beginTrans = function(){
  return this.query.beginTrans();
};

/**
 *  Commits transaction and return its result
 */
Adapter.prototype.commitTrans = function(){
  return this.query.commitTrans();
};

/**
 *  Rollbacks the transaction (in case of error)
 */
Adapter.prototype.rollbackTrans = function(){
  return this.query.rollbackTrans();
};


/**
 *  Prepares db to insert the passing model
 *
 *  @param model (Object Model) the model you're going to insert
 *
 *  @return (Boolean) true if everything went fine. False if not
 */
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


/**
 *  Prepares db for updating the passing model
 *
 *  @param model (Object Model) the model you're going to update
 *
 *  @return (Boolean) true if everything went fine. False if not
 */
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


/**
 *  Prepares db deleting the passing model
 *
 *  @param model (Object Model) the model you're going to delete
 *
 *  @return (Boolean) true if everything went fine. False if not
 */
Adapter.prototype.queryDelete = function(model){
  return this.query.queryDelete( model );
};



/**
 *  Closes the connection to database
 */
Adapter.prototype.close = function(){
  this.db.closeSync();
  return true;
};


/**
 *  Returns the Model mapper given the name
 *
 *  @param name (String) the name of the model mapper we want. It corresponds to the table name of the database
 *
 *  @return (Object) the model mapper
 */
Adapter.prototype.modelByName = function(name){
  return this._models[ name ];
};


/**
 *  Performs a migration
 */
Adapter.prototype.migrateUp = function(){
  Logger( "This method is not implemented yet ")
};


/**
 *  Rollbacks a migration
 */
Adapter.prototype.migrateDown = function(){
  Logger( "This method is not implemented yet ")
};


/**
 *  Declares a model
 *
 *  @param modelName (String) the model name of the model you're going to declare
 *  @param initializer (Object) the options of the model you're going to declare
 *
 *  @return (Object) the new Model mapper
 */
Adapter.prototype.declare = function(modelName, initializer){

  Logger( "New model declaration: ", modelName);

  var model = Model.declareModel(this, modelName, initializer);

  return this._models[ model._table_name ] = model;
};