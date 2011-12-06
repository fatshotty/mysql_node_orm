require('./inflector');
var Utils = require('./utils');
var Logger = require("logging").from(__filename);


// TODO: refactor of datatype

var
  EventEmitter = require('events').EventEmitter,
  DataType = require('./datatype'),
  MODEL_CLASS_NAME = 'node-ar.Model',
  MODEL_COLLECTION_CLASS_NAME = 'node-ar.ModelCollection';


module.exports.declareModel = function(dbAdapter, tableName, initializer){

  var
    TABLE_NAME = tableName.pluralize().underscore(),
    FIELDS = initializer.fields,
    BELONGS_TO = initializer.belongs_to || [],
    HAS_MANY = initializer.has_many || [],
    METHODS = initializer.methods || {},
    EVENTS = initializer.events || {},
    DESTROY = [];

  delete initializer.fields;
  delete initializer.belongs_to;
  delete initializer.has_many;
  delete initializer.methods;
  delete initializer.events;

  var _TMP_DESTROY = initializer.destroy || [];
  delete initializer.destroy;



  var FIELDS_NAMES = Object.keys( FIELDS );

  FIELDS[ 'id' ] = {
    type: DataType.Int,
    unique: true
  };
  FIELDS_NAMES.unshift( 'id' );


  function Klass(data){
    this._fields = {};
    this._updated_fields = {};
    this.__relations = {};
    this.__belongsTo = {};
    this._LOADED = false;

    this.before_create(data);

    if ( data ){
      // This could be called by ModelCollection
      var my_data = data[ this._table_name ];
      if ( ! my_data ) my_data = data;

      var id = my_data.id;
      delete my_data.id;
      this._parseRecordset( my_data );
      this._id_ = id;
    } else {
      // Logger("Instanciating a new empty ", Klass._table_name);
    }


    var eventsType = Object.keys(EVENTS);
    eventsType.forEach(function(ev){
      var callback = EVENTS[ ev ];
      if ( typeof callback == 'function')
        this.on(ev, EVENTS[ ev ] );
    }, this);


    this.initialize(data);

    this.after_create();


    this._LOADED = true;

    return this;
  }

  Klass.prototype.__proto__ = EventEmitter.prototype;



  /**
   *  Default Getter methods
   */
  Klass.prototype.__defineGetter__('__class_name__', function(){
    return Klass.__class_name__;
  });

  Klass.prototype.__defineGetter__('id', function(){
    return this._fields[ 'id' ];
  });
  Klass.prototype.__defineSetter__('_id_', function(value){
    this._fields[ 'id' ] = value;
  });
  Klass.prototype.__defineGetter__('_db', function(){
    return dbAdapter;
  });
  Klass.prototype.__defineGetter__('_table_name', function(){
    return Klass._table_name;
  });
  Klass.prototype.__defineGetter__('_declared_fields', function(){
    return Klass.declared_fields;
  });
  Klass.prototype.__defineGetter__('_relations', function(){
    return this.__relations;
  });
  Klass.prototype.__defineGetter__('_belongsTo', function(){
    return this.__belongsTo;
  });
  Klass.prototype.__defineGetter__('_dependent_destroy', function(){
    return Klass.dependent_destroy;
  });


  Klass.prototype.formattedFieldValue =  function(fName){
    var
      f = FIELDS[ fName ],
      fType = f ? f.type : null,
      fValue = f ? this[ fName ] : null
      fCast = fType ? fType.cast( null, fValue ) : null;
    return fCast;
  }


  Klass.prototype.initialize = function(){return this;};
  Klass.prototype.before_create = function(){};
  Klass.prototype.after_create = function(){};

  Klass.prototype.update_attributes = function(attributes){
    // TODO: update attributes
  };

  Klass.prototype.reload = function(){
    var
      id = this.id;

    if ( !id ) return false;

    this.emit('clear');

    var fields = {}, where = {}
    fields[ this._tableName ] = FIELDS_NAMES;
    where[ this._tableName ] = {id: this.id};

    var res = this._db.querySelect( fields, [ this._tableName ], {where: where});
    if ( res ){
      this._parseRecordset( res[0] );
    }

    this.emit('reloaded');

    return res;
  };


  Klass.prototype.validate = function(){
    var errors = {};

    FIELDS_NAMES.forEach(function(fName){
      var
        fData = FIELDS[ fName ],
        fValidation = fData.validation;

      if ( fValidation instanceof Array ){
        for(var i = 0, l = fValidation.length; i < l; i++){
          var fn = fValidation[ i ];
          var res = fn.call(this, this[fName] );
          if ( res !== true )
            errors[ fName ] = res;
        }
      }

    }, this);

    return Object.keys(errors).length > 0 ? errors : true;
  };

  Klass.prototype.before_save = function(){
    this.emit('beforeSave');
    return this.validate();
  };

  Klass.prototype.save = function(relations){

    var bsave = this.before_save();

    if ( !bsave ) return false;

    var
      executed = false,
      // An already existing transaction is opened. It due to a sequence of query
      is_trans_active = this._db.isTransActive;

    if ( !is_trans_active ){
      this._db.beginTrans();
    }

    this.emit('save');

    // TODO: the id is automagically added
    var _id = this.id;
    executed = _id ? this._db.queryUpdate( this ) : this._db.queryInsert( this );

    if ( executed && relations ){
      var
        relationsModels = this._relations,
        relationsModelNames = Object.keys(relationsModels);
      for(var i = 0, l = relationsModelNames.length; i < l; i++ ){
        var rel = relationsModelNames[ i ];
        var collection = relationsModels[ rel ];
        if ( collection && collection.__class_name__ == ModelCollection.__class_name__ ){
          if (   ( executed = collection.save(relations) )   )
            break;
        }
      }
    }

    // Logger(this._table_name, this.id, executed);

    if ( ! is_trans_active ){
      if ( executed ){
        this._db.commitTrans();
      } else {
        this._db.rollbackTrans();
      }
    }

    if ( executed ){
      this._updated_fields = {};
    } else {
      // in case of error: restore the ID
      this._id_ = _id;
    }

    return executed;

  };

  Klass.prototype.after_save = function(){
    return this.emit('afterSave');
  };

  Klass.prototype.before_delete = function(){
    this.emit('beforeDelete');
    return !!this.id;
  };
  Klass.prototype.delete = function(relations){
    var bdelete = this.before_delete();

    if ( ! bdelete ) return false;
    var
      executed = false,
      // An already existing transaction is opened. It due to a sequence of query
      is_trans_active = this._db.isTransActive;

    if ( !is_trans_active ){
      this._db.beginTrans();
    }

    this.emit('delete');

    relations = relations && this._dependent_destroy.length;

    if ( relations ){
      var
        destroyModels = this._dependent_destroy;

      for( var i = 0, l = destroyModels.length; i < l; i++ ){

        var
          dModel = destroyModels[ i ],
          dModelName = dModel.pluralize().underscore(),
          relation = this.__relations[ dModelName ],
          collection = null;
        if ( relation && relation.__class_name__ == ModelCollection.__class_name__ ) {
          collection = relation;
        } else {
          collection = new ModelCollection( dModelName, this, null );
        }

        if ( !  ( executed = collection.delete(relations) )  )
          break;

      }

    } else {
      executed = true;
    }

    if ( executed ){
      executed = this._db.queryDelete( this );
    }

    if ( ! is_trans_active ){
      if ( executed ){
        this._db.commitTrans();
      } else {
        this._db.rollbackTrans();
      }
    }

    if ( executed )
      // TODO: the transaction could be rollback, restore the id
      this._id_ = null;

    return executed;

  };
  Klass.prototype.after_delete = function(){
    return this.emit('delete');
  };


  Klass.prototype.before_destroy = function(){
    this.emit('beforeDestroy');
    return true;
  };
  Klass.prototype.destroy = function(){

    this.delete()

    this._fields = {};
    this._updated_fields = {};
    this.__relations = {};
    this.__belongsTo = {};
    this._LOADED = false;

    return true;

  };

  Klass.prototype.after_destroy = function(){
    return this.emit('afterDestroy');
  };


  // Methods inheritance
  Utils.extendMethods( Klass.prototype, METHODS );


  Klass.prototype._parseRecordset = function(record){

    // Logger( this._table_name, "parsing record" );
    var fNames = Object.keys(record);

    fNames.forEach(function(fName){

      this[ fName ] = record[ fName ];

    },this);


    return this;
  }


  FIELDS_NAMES.forEach(function(fname){
    if ( fname != 'id' ){
      Klass.prototype.__defineGetter__( fname, function(){
        return this._updated_fields[ fname ] || this._fields[ fname ];
      });
      Klass.prototype.__defineSetter__( fname, function(value){
        if ( this._fields[ fname ] !== value && this._LOADED ){
          this._updated_fields[ fname ] = value;
        }
        this._fields[ fname ] = value;
      });
    }
  });


  BELONGS_TO.forEach(function(fname){

    var
      fieldName = fname.singularize().underscore(), // tranformed in 'web_user'
      belongToModelName = fname.pluralize().underscore(), // transformed in 'web_users'
      fieldNameId = fieldName + '_id';  // becomes 'web_user_id'


    FIELDS[ fieldNameId ] = { type: DataType.Int, belongsTo: belongToModelName };
    FIELDS_NAMES.push( fieldNameId );

    // GET var user = address.user
    Klass.prototype.__defineGetter__(fieldName, function(){
      if ( this.__belongsTo[ fieldName ] ){
        return this.__belongsTo[ fieldName ];
      } else {
        var id = this._fields[ fieldNameId ];
        if ( id ){
          var model = dbAdapter.modelByName( belongToModelName );
          return this.__belongsTo[ fieldName ] = model.find( id );
        } else {
          return null;
        }
      }
    });

    // SET address.user = user
    Klass.prototype.__defineSetter__(fieldName, function(value){
      if ( this.__belongsTo[ fieldName ] !== value ){
        this[ fieldNameId ] = value.id;
        this.__belongsTo[ fieldName ] = value;
      }
    });

    // var id = address.user_id
    Klass.prototype.__defineGetter__( fieldNameId, function(){
      return this._fields[ fieldNameId ];
    });

    // address.user_id = 4
    Klass.prototype.__defineSetter__( fieldNameId, function(value){
      if ( this._fields[ fieldNameId ] != value ) {
        this._updated_fields[ fieldNameId ] = value;
        // Empty cache, we have to reload the model from db
        this.__belongsTo[ fieldName ] = null;
      }
      this._fields[ fieldNameId ] = value;
    });
  });


  HAS_MANY.forEach(function(fname){
    // fname is 'Address'
    var hasmanyModelName = fname.pluralize().underscore(); // addresses
    var hasmanyIdsName = fname.singularize().underscore() + '_ids';

    // Logger("Binding has_many relations", hasmanyModelName, hasmanyIdsName);

    // GET var addresses = user.addresses
    // SET user.addresses = ModelCollection
    // GET var ids = user.address_ids
    // SET user.address_ids = [ 1, 2, 3 ]

    // GET addresses
    Klass.prototype.__defineGetter__( hasmanyModelName, function(){

      var results = this.__relations[ hasmanyModelName ];

      if ( ! results ){
        var model = this._db.modelByName(hasmanyModelName);
        if ( model ){
          if ( this.id ){
            var find = model[ 'find_by_' + this._table_name.singularize() + '_id' ];
            var collection = find ? find( this.id ) : null;
            collection.belongsTo = this;
            results = collection;
          } else {
            results = new ModelCollection(hasmanyModelName, this, null);
          }
        }
      }
      return this.__relations[ hasmanyModelName ] = results;

    });

    // SET user.addresses = ModelCollection
    Klass.prototype.__defineSetter__( hasmanyModelName, function(collection){
      if ( collection.__class_name__ == ModelCollection.__class_name__ ) {

        collection.belongsTo = this;
        this.__relations[ hasmanyModelName ] = collection;
        return true;

      } else {
        return false;
      }
    });



    // GET user.address_ids
    Klass.prototype.__defineGetter__( hasmanyIdsName, function(){
      var collection = this.__relations[ hasmanyModelName ];
      var ids = [];
      collection.forEach(function(m){
        ids.push( m.id );
      });
      return ids;
    });

    // SET user.address_ids = [ 1, 2, 3 ]
    Klass.prototype.__defineSetter__( hasmanyIdsName, function(collection_ids){

      var results = new ModelCollection(hasmanyModelName, this, null);
      collection_ids.forEach(function(collection_id){

        var model = this._db.modelByName( hasmanyModelName );
        var m = model.find( collection_id );
        results.push( m );

      });

      this.__relations[ hasmanyModelName ] = results;
      return true;
    });

  });



  _TMP_DESTROY.forEach(function(d){
    if ( HAS_MANY.indexOf( d ) > -1 ){
      DESTROY.push( d );
    }
  });


  /* Static methods */

  Klass.__defineGetter__('__class_name__', function(){
    return MODEL_CLASS_NAME;
  });

  Klass.__defineGetter__('_table_name', function(){
    return TABLE_NAME;
  });

  Klass.__defineGetter__('declared_fields', function(){
    return FIELDS_NAMES;
  });

  Klass.__defineGetter__('has_many', function(){
    return HAS_MANY;
  });

  Klass.__defineGetter__('belongs_to', function(){
    return BELONGS_TO;
  });

  Klass.__defineGetter__('dependent_destroy', function(){
    return DESTROY;
  });


  Klass.find_by = function(whereFields, options, limit){

    var dbFields = {};
    var tables = [ Klass._table_name ];
    var includes = options ? options.includes : null;
    var joins = options ? options.joins : null;

    if ( includes ){
      // Should be an array
      tables = tables.concat( includes );
    }

    tables.forEach(function(t){
      var model = dbAdapter.modelByName(t);
      dbFields[ model._table_name ] = model.declared_fields;
    });

    var conditions = {
      joins: joins,
      where: whereFields
    };

    // TODO: limit management

    var recordset = dbAdapter.querySelect( dbFields, tables, conditions ) || [];
    return recordset;
  }


  // Binding to 'find_by_id'
  Klass.find = function(what, options){
    var where = {}, limit = null;
    var dbFields = where[ Klass._table_name ] = {};
    if ( typeof what == 'number' ){
      dbFields.id = what;
      limit = 1;
    } else {
      switch( what ){
        case 'first':
          limit = 1
          where = null;
          break;
        case 'all':
        default:
          where = null;
          limit = 0
      }
    }

    var recordset = Klass.find_by( where, options );
    if ( limit ){
      var collection = __parseRecordset(Klass, recordset.slice(0,1));
      return collection[0];
    } else {
      return __parseRecordset(Klass, recordset);
    }

  };


  FIELDS_NAMES.forEach(function(fname){
    var fieldData = FIELDS[ fname ], fieldDataType = fieldData.type;

    Klass[ 'find_by_' + fname ] = function(what, options){
      var
        fieldValue = fieldDataType.cast( fieldData, what ),
        where = {};

      // Logger( Klass._table_name + ".find_by_" + fname, what);

      where[ Klass._table_name ] = {};
      where[ Klass._table_name ][ fname ] = fieldValue;

      var recordset = Klass.find_by(where, options, fieldData.unique ? 1 : null);

      var collection = __parseRecordset(Klass, recordset);

      if ( (options && (options.includes || options.joins ))  ||  !fieldData.unique ){
        return collection;
      } else {
        return collection[0];
      }

    };
  });




   var __parseRecordset = function( klass, recordset ){

    // Logger( "__parseRecordset for", klass._table_name);

    var
      models = {},
      currentModelName = klass._table_name,
      id_field = currentModelName + '_id',
      collection = new ModelCollection( currentModelName );


    // plaining recordset
    /*
    [
      {
        authors: {
          id: 1,
          name: 'foo'
        },
        books: {
          id: 3,
          name: 'bar',
          author_id: 1
        }
      }
    ]
     */
    recordset.forEach(function(record){

      var currentModelRecord = record[ currentModelName ];
      delete record[ currentModelName ];

      var
        dbTables = Object.keys(record);

      var currentModelId = currentModelRecord.id;
      var currentModel = models[ '' + currentModelId ];
      if ( ! currentModel ){
        currentModel = models[ '' + currentModelId ] = new klass( currentModelRecord );
      }

      dbTables.forEach(function(dbTable){
        var tableRelation = dbTable.singularize().camelize();
        var is_has_many_relation = klass.has_many.indexOf( tableRelation ) > -1;
        var is_belongs_to_relation = klass.belongs_to.indexOf( tableRelation ) > -1;

        var relationModel = dbAdapter.modelByName( dbTable );
        relationModel = new relationModel(  record[ dbTable ]  );
        // // Logger("New relationModel for", currentModelName, ':', dbTable);

        if ( is_has_many_relation ){
          // // Logger('found has_many relation', dbTable);
          var has_many = currentModel._relations[ dbTable ];
          if ( !has_many ){
            has_many = currentModel[dbTable] = new ModelCollection(dbTable, currentModel, null);
          }
          has_many.push( relationModel );

        } else if ( is_belongs_to_relation ){
          // // Logger('found belongs_to relation', dbTable);

          currentModel[ dbTable ] = relationModel;

        } else {
          // // Logger("No relations has been associated");
        }

      });


    });

    var modelsFound = Object.keys(models);
    modelsFound.forEach(function(id){
      collection.push(  models[ id ]  );
    });

    return collection;

  };




  function ModelCollection(tableName, parent, records){

    this.__table_name = tableName;

    this.populateFromRecordset( records );

    if ( parent ){
      this.belongsTo = parent;
    }

    return this;
  }

  ModelCollection.__defineGetter__('__class_name__', function(){
    return MODEL_COLLECTION_CLASS_NAME;
  });


  ModelCollection.prototype.__proto__ = Array.prototype;


  ModelCollection.prototype.__defineGetter__('__class_name__', function(){
    return ModelCollection.__class_name__;
  });

  ModelCollection.prototype.__defineGetter__('_table_name', function(){
    return this.__table_name;
  });

  ModelCollection.prototype.__defineGetter__('belongsTo', function(){
    return this._belong_to_model;
  });
  ModelCollection.prototype.__defineSetter__('belongsTo', function(model){
    if ( model.__class_name__ == Klass.__class_name__ ){
      this._belong_to_model = model;

      var column_name = this._parent_column_name;

      this.forEach(function(m){
        m[ column_name ] = this._belong_to_model;
      }, this);

    } else {
      throw "Model instance is needed for ModelCollection";
    }
  });

  ModelCollection.prototype.__defineGetter__('_parent_column_name', function(){
    return this._parent_belongs_to_name ? this._parent_belongs_to_name + '_id' : null;
  });

  ModelCollection.prototype.__defineGetter__('_parent_belongs_to_name', function(){
    return this.belongsTo ? this.belongsTo._table_name.singularize().underscore() : null;
  });


  ModelCollection.prototype.reload = function(){

    if ( this._parent_column_name ) {
      this.length = 0;
      var model = dbAdapter.modelByName( this._table_name );
      var collection = model['find_by_' + this._parent_column_name ]( this.belongsTo.id );
      collection.forEach(function(m){
        this.push(m);
      },this);
    }

  };

  ModelCollection.prototype.save = function(relations){
    var result = false, parent_id = null;
    if ( this.belongsTo ){
      parent_id = this.belongsTo.id;
    }
    if ( ! parent_id ) {
      // Logger("No perent id for", this._table_name);
    }
    for( var i = 0, l = this.length; i < l; i++ ){
      var m = this[i];
      if ( parent_id ){
        m[ this._parent_column_name ] = parent_id;
      }
      if ( ! ( result = m.save(relations) ) )
        break;
    }
    return result;
  };

  ModelCollection.prototype.delete = function(relations){
    var result = false;
    if ( this.length == 0 ){
      var dbFields = {}, where = {};
      dbFields[ this._table_name ] = [ 'id' ];
      where[ this._table_name ] = {}
      where[ this._table_name ][ this._parent_column_name ] = this.belongsTo.id;

      var records = dbAdapter.querySelect( dbFields, [ this._table_name ], {where: where} );
      this.populateFromRecordset( records );
    }

    for( var i = 0, l = this.length; i < l; i++ ){
      var m = this[i];
      if ( ! ( result = m.delete(relations) ) )
        break;
    }
    return result;
  };

  ModelCollection.prototype.populateFromRecordset = function(records){
    if ( records instanceof Array ){
      records.forEach(function(r){
        var model = dbAdapter.modelByName( this._table_name );
        if ( ! model ){
          throw "no Model found under name " + this._table_name;
        }
        model = new model(r);
        this.push(model);
      },this);
    }
  };

  var __push = Array.prototype.push;
  ModelCollection.prototype.push = function(m){
    if ( this.belongsTo ){
      m[ this._parent_belongs_to_name ] = this.belongsTo;
    }
    __push.call(this, m);
  };

  ModelCollection.prototype.concat = function(model){
    throw "this method cannot be called on ModelCollection"
  };
  ModelCollection.prototype.shift = function(model){
    throw "this method cannot be called on ModelCollection"
  };
  ModelCollection.prototype.unshift = function(model){
    throw "this method cannot be called on ModelCollection"
  };
  ModelCollection.prototype.splice = function(model){
    throw "this method cannot be called on ModelCollection"
  };


  module.exports.ModelCollection = ModelCollection;

  return Klass;
};