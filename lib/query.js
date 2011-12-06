var Logger = require("logging").from(__filename);

module.exports = Query;

var _is_trans_active = false;

/**
 *  This is the main class used to build and perform a query
 *  @params db Object repreenting the database used for performing queries
 */
function Query(adapter){
  this.__defineGetter__('_adapter', function(){
    return adapter;
  });
  this.__defineGetter__('_db', function(){
    return this._adapter.db;
  });
  return this;
}


/**
 *  This method parses an object representing all tables fields
 *  and returns the relative SELECT syntax
 *  @param dbFields object like this:
 *  {
 *    table_name1: [ 'field1', 'field2' ],
 *    table_name2: [ 'field1', 'field2' ]
 *  }
 */
Query.prototype.parseFields = function( dbFields ){
  var
    query = [],
    tables = Object.keys(dbFields);

  tables.forEach(function(t){
    var
      _fields = [],
      fields = dbFields[ t ];
    fields.forEach(function(f){
      var
        fName = '`' + t + '`' + '.`' + f + '`',
        fAlias = t + '_' + f;
      _fields.push( fName + ' AS ' + fAlias );
    });

    query = query.concat( _fields );
  });

  return query.join(', ');
}

/**
 *  This method parses an Array of table names and returns
 *  the relative FROM syntax
 *  @params dbTables Array of table name
 */
Query.prototype.parseTables = function( dbTables ){
  return dbTables.join(', ');
}



/**
 *  This method parses an Object representing the 'join' conditions and
 *  returns the relative INNER JOIN syntax
 *  @param joinConditions Object like this
 *  {
 *    table_name: {
 *      field1: {
 *        table_name_on_condition: 'field2'
 *      }
 *    }
 *  }
 */
Query.prototype.parseJoinConditions = function( joinConditions ){

  if ( ! joinConditions ) return null;

  var
    query = [],
    dbTables = Object.keys( joinConditions );

  dbTables.forEach(function(dbTable){
    var dbTableObject = joinConditions[dbTable];

    var dbFields = Object.keys( dbTableObject );

    var queryField = [];

    dbFields.forEach(function(dbField){
      var relationsObject = dbTableObject[ dbField ];

      relations = Object.keys( relationsObject );
      var relation = relations[0];
      var
        table = relation,
        field = relationsObject[ relation ];

      queryField.push( 'ON ' + '`' + table + '`.' + field );


    });

    query.push(' `' + dbTable + '` ' + queryField.join(' AND ') );

  });

  return query.join(' INNER JOIN ');

}


/**
 *  This method parses an Object representing the 'where' conditions and
 *  returns the relative WHERE syntax
 *  @param whereConditions Object like this
 *  {
 *    table_name: {
 *      field1: 'value'
 *    }
 *  }
 */
Query.prototype.parseWhereConditions = function( whereConditions ){

  if ( ! whereConditions ) return null;

  var
    self = this,
    query = [],
    dbTables = Object.keys(whereConditions);

  dbTables.forEach(function(dbTable){

    var dbFieldsObject = whereConditions[ dbTable ];
    dbFields = Object.keys( dbFieldsObject );

    var queryFields = [];
    dbFields.forEach(function(dbField){
      var
        fName = dbField,
        fValue = dbFieldsObject[ fName ];
      queryFields.push(  '`' + dbTable + '`.' + fName + '=' + fValue  );
    });

    query = query.concat( queryFields );

  });

  return query.join( ' AND ' );
}


/**
 *  This method builds a sql like SELECT string and invokes
 *  the #{_executeQuery} method
 */
Query.prototype.querySelect = function( dbFields, dbTables, dbConditions ){

  var
    query = [],
    fields = this.parseFields( dbFields ),
    tables = this.parseTables( dbTables );

  query.push(  'SELECT ' + fields  );
  query.push(  'FROM ' + tables  );

  if (dbConditions){
    if ( dbConditions.joins ){
      var joinConditions = this.parseJoinConditions( dbConditions.joins );
      query.push(  'INNER JOIN ' + joinConditions  );
    }

    if ( dbConditions.where ){
      var whereConditions = this.parseWhereConditions( dbConditions.where );
      query.push(  'WHERE ' + whereConditions );
    }
  }

  query = query.join(' ');

  var recordset = this._executeQuery( query, true );
  if ( recordset ){

    return this.parseRecordset( dbFields, recordset );

  } else {
    // Logger("no recordset returned");
  }
  return null;
};



/**
 *  This method builds a sql like UPDATE string and invokes
 *  the #{_executeQuery} method
 */
Query.prototype.queryUpdate = function( tableName, dbFields, fieldId ){

  var query = ["UPDATE " + tableName + " SET"], queryFields = [];

  var dbFieldNames = Object.keys(dbFields);
  dbFieldNames.forEach(function(fName){
    queryFields.push( fName + '=' + dbFields[ fName ] );
  });
  query.push( queryFields.join(', ') );

  fieldId && query.push("WHERE id=" + fieldId);

  query = query.join(' ');

  return this._executeQuery( query, false);
};



/**
 *  This method builds a sql like INSERT string and invokes
 *  the #{_executeQuery} method
 */
Query.prototype.queryInsert = function( tableName, dbFields ){
  var
    query = ["INSERT INTO " + tableName ],
    queryFieldsNames = [], queryFieldsValues = [];

  var dbFieldNames = Object.keys(dbFields);
  dbFieldNames.forEach(function(fName){
    queryFieldsNames.push( fName );
    queryFieldsValues.push( dbFields[ fName ] );
  });
  query.push( '(' + queryFieldsNames.join(', ') + ')' );
  query.push( 'VALUES (' + queryFieldsValues.join(', ') + ')' );

  query = query.join(' ');

  return this._executeQuery( query, false);
};



/**
 *  This method builds a sql like DELETE string and invokes
 *  the #{_executeQuery} method
 */
Query.prototype.queryDelete = function(model){
  var query = ["DELETE FROM", model._table_name, "WHERE id=" + model.id];
  return this._executeQuery( query.join(' '), false);
}



/**
 *  This method parses the row data returned by mysql\
 *  It create an Array of object like this:
 *    {
 *      table_foo_name: {
 *        field_foo_name_one: 'field_foo_value_one',
 *        field_foo_name_two: 'field_foo_value_two'
 *      },
 *      table_bar_name: {
 *        field_bar_name_one: 'field_bar_name_one'
 *      }
 *    }
 */
Query.prototype.parseRecordset = function(dbFields, recordset){

  var
    results = [],
    dbTables = Object.keys(dbFields);


  if ( !(recordset instanceof Array) ){
    // Logger("no valid recordset", recordset);
    return [];
  }

  // Sorting fields by length of the name: first the longer
  dbTables.sort(function(a,b){
    return a.length < b.length;
  });


  recordset.forEach(function(record){

    var
      recordResult = {},
      recordFields = Object.keys( record );

    dbTables.forEach(function(dbTable){

      recordFields.forEach(function(recordField){

        if ( recordField.indexOf( dbTable ) == 0 ){
          var f = recordField.substring( (dbTable + '_').length );
          var r = recordResult[ dbTable ];
          if ( !r ){
            r = recordResult[ dbTable ] = {};
          }
          r[ f ] = record[ recordField ];
        }

      }, this);


    },this);

    results.push( recordResult );

  },this);

  recordset.freeSync && recordset.freeSync();

  return results;

};


/**
 *  It returns the state of the transaction
 */
Query.prototype.__defineGetter__('isTransActive', function(){
  return _is_trans_active;
});


/**
 *  Says database to start a new transaction
 */
Query.prototype.beginTrans = function(){
  if ( ! _is_trans_active ){
    _is_trans_active = this._db.querySync( "START TRANSACTION WITH CONSISTENT SNAPSHOT;" );

    if ( _is_trans_active ){
      Logger('BEGIN TRANSACTION');
    }
  }

  return _is_trans_active;
};


/**
 *  Says database to commit the transaction
 */
Query.prototype.commitTrans = function(){
  if ( _is_trans_active ){
    var res = this._db.querySync( "COMMIT;" );
    if ( res ) {
      _is_trans_active = false;
      Logger('COMMIT TRANSACTION');
    }
  }
  return ! _is_trans_active;
};


/**
 *  Says database to rollback the transaction
 */
Query.prototype.rollbackTrans = function(){
  if ( _is_trans_active ){
    var res = this._db.querySync( "ROLLBACK;" );
    if ( res ) {
      _is_trans_active = false;
      Logger('ROLLBACK TRANSACTION');
    }
  }
  return ! _is_trans_active;
};


/**
 *  This method executes the query string and returns a raw data read from database
 */
Query.prototype._executeQuery = function ( queryString, multiple ){
  // Temporary unvailable
  Logger("Executing query: ", queryString);
  var query = this._db.querySync( queryString );
  if ( typeof query == 'boolean' ){
    // Logger("Result:", query);
    query = multiple ? [] : query;

  } else if ( typeof query == 'string' ){
    Logger( "Error:", query);
    query = multiple ? [] : false;
  } else {
    query = query.fetchAllSync ? query.fetchAllSync() : [];
  }
  return query;
}