# mysql_node_orm

## Purpose

A simple `ActiveRecord like` nodejs module for mysql.

It supports 'has_many' and 'belongs_to' relationship.

You can `find` and `find_by*` each field name.

**Important**: it works synchronously.

## Introduction

This module is based on Sannis's [node-mysql-libmysqlclient](https://github.com/Sannis/node-mysql-libmysqlclient).

Node-Ar adds some simple features as ActiveRecord does.

I want to explain that it is not completed. This should be considered an example.

But I would to expand it also with your help.

So, do not hesitate to contact me for any question or doubts

My mind is open for any collaboration ;)

## Installation

For installing this module use

```
npm install mysql_node_orm
```

## Usage

See file in the `spec` folder for examples


## Overview
Having a DB as ActiveRecord on Rails wants.
You can able to perform `select` `insert` and `update` using `Models` like instances.

```javascript
var DataType = require('mysql_node_orm/lib/datatype');
var Adapter = require('mysql_node_orm');

var Author = Adapter.declare('Author', {
  has_many: ['Book'],
  destroy: [ 'Book' ],
  fields: {
    name: {
      type: DataType.String,
      unique: true
    },
    age: {
      type: DataType.Int
    }
  }
});

Book = Adapter.declare('Book', {
  belongs_to: ['Author'],
  fields: {
    name: {
      type: DataType.String
    },
    pages_number: {
      type: DataType.Int
    }
  },
  methods:{
    foo: function(bar){
      this.test();
      return 'foobar ' + bar;
    },
    test: function(){
      return 'test method'
    }
  }
});

var author = Author.find( 1 );
var books = author.books

book = new Book({
  name: 'Foobar book'
});

book.pages_number = 1024;

books.push( book );

author.save( true );

Adapter.close();
```


### Adapter(host, user, pwd, database, port)
* it is the main class

```javascript
var Adapter = require('mysql_node_orm');
var adapter = new Adapter( 'localhost', 'root', 'password', 'db_name', 3306);
```


### DataType (used to declare the fields)
* DataType.String           # the VARCHAR type
* DataType.Int              # the INT type
* DataType.Boolean          # the TYNINT type

`(tmporarly incompleted)`

```javascript
// To use the datatype
var DataType = require('mysql_node_orm/lib/datatype')
```

### Model

(Static methods)

* Model.find( id /* as NUM */ )   # returns the instance of the model if found. Otherwise null
* Model.find( 'all' )             # returns an Array instance contaning all model found by performing the `select`. Empty array if no record found
* Model.find( 'first' )           # returns the instance of the model representing the first matched record if found. Otherwise null
* Model.find_by( where, options, limit )
#### where (Object)
    ```javascipt
    where = {
      field_foo_name: field_foo_value,
      field_bar_name: field_bar_value,
    }
    ```
#### options (Object)
    ```javascript
    options = {
      includes: ['table_foo_name', 'table_bar_name'],
      joins: {
        table_foo_name: {                       // INNER JOIN table_foo_name
          field_bar_name: {                     // ON  field_bar_name
            table_xxxx_name: 'field_xxxx_name'  // = table_xxxx_name.field_xxxx_name
          }
        }
      }
    }
    ```
#### limit (Number)    Used as `LIMIT` sql condition

* Model.find_by_foo_field_name( value )     # return an Array containing the result of `select * from table_foo_name where FOO_FIELD_NAME = VALUE`. A Model single instance if field id declared as unique


## Todo

What i'm going to do:

* has_many_through relations
* has_many dependent destroy
* DataType conversion

* More documentation is coming... ;)


## Done
* Delete model and its `dependencies`
* Implement events
* Fields validation