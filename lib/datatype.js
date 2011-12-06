Utils = require('./utils');

module.exports = {

  "Date": {
    cast: function(field, value){
      // TODO
      return value;
    },
    dbtype: "date"
  },

  "DateTime": {
    cast: function(field, value){
      // TODO
      return value;
    },
    dbtype: "datetime"
  },

  "Boolean": {
    cast: function(field, value){
      if ( typeof value != 'boolean' ) value = !!value;
      return value ? 1 : 0;
    },
    dbtype: "tinyint(1)"
  },

  "Decimal": {
    cast: function(field, value){
      // TODO
      return value;
    },
    dbtype: "decimal"
  },

  "Float": {
    cast: function(field, value){
      // TODO
      return value;
    },
    dbtype: "float"
  },

  "Int": {
    cast: function(field, value){
      // TODO
      return value;
    },
    dbtype: "int(11)"
  },

  "String": {
    cast: function(field, value){
      value = Utils.isDefined(value) ? value : '';
      if ( value.length > this.defaultLength ) value = value.substring(0, this.defaultLength );
      return "'" + value + "'";
    },
    dbtype: "varchar(?)",
    defaultLength: 255
  },

  "Text": {
    cast: function(field, value){
      // TODO
      return "'" + value + "'";
    },
    dbtype: "text"
  },

  "Time": {
    cast: function(field, value){
      // TODO
      return value;
    },
    dbtype: "time"
  },

  "Timestamp": {
    cast: function(field, value){
      return (new Date()).getTime();
    },
    dbtype: "timestamp"
  }

};