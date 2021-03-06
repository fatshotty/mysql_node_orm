var DataType = require('../lib/datatype');

var DATABASE = 'test_database';


var Adapter = require('../index');
Adapter = new Adapter( 'localhost', 'root', '' );

var Query = Adapter.query;



var AUTHOR_TABLE = "CREATE TABLE authors (\
  `id` int(11) NOT NULL AUTO_INCREMENT,\
  `name` varchar(255) NOT NULL,\
  `age` int(11) null,\
  PRIMARY KEY (`id`)\
)";

var BOOKS_TABLE = "CREATE TABLE books (\
  `id` int(11) NOT NULL AUTO_INCREMENT,\
  `name` varchar(255) NOT NULL,\
  `pages_number` int(11) null,\
  `author_id` int(11) not null,\
  PRIMARY KEY (`id`)\
)";


var Author, Book;


describe('Initializing database',function(){

  it('it should create a database ' + DATABASE, function(){

    expect( Query._executeQuery( "CREATE DATABASE IF NOT EXISTS " + DATABASE) ).toBeTruthy();
    expect( Query._executeQuery( "USE " + DATABASE) ).toBeTruthy();

  });

  it('it should create the table Authors', function(){

    expect( Query._executeQuery( "DROP TABLE IF EXISTS authors") ).toBeTruthy();
    expect( Query._executeQuery( AUTHOR_TABLE ) ).toBeTruthy();

  });

  it('it should create the table books', function(){

    expect( Query._executeQuery( "DROP TABLE IF EXISTS books") ).toBeTruthy();
    expect( Query._executeQuery( BOOKS_TABLE ) ).toBeTruthy();

  });

});


describe('Model declaration', function(){

  it('Author should be a Model class', function(){

    Author = Adapter.declare('Author', {
      has_many: ['Book'],
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

    expect( Author.declared_fields ).toBeDefined();
    expect( Author.__class_name__ ).toBeDefined();
    expect( Author._table_name ).toEqual('authors');

  });


  it('Book should be a Model class', function(){

    Book = Adapter.declare('Book', {
      belongs_to: ['Author'],
      fields: {
        name: {
          type: DataType.String,

        },
        pages_number: {
          type: DataType.Int,
          validation:[ function(value){return value == 'foobar' ? 'no foobar allowed' : true} ]
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
      },
      events:{
        afterSave: function(){
          this.after_save_fired = true;
        }
      }
    });

    expect( Book.declared_fields ).toBeDefined();
    expect( Book.__class_name__ ).toBeDefined();
    expect( Book._table_name ).toEqual('books');

  });

});



describe("Book validation", function(){

  var book;
  it("should fail validation for one field", function(){

    var book = new Book();
    book.pages_number = 'foobar';
    var errors = book.validate();

    expect( errors['pages_number']).toBeDefined();
    expect( errors['pages_number']).toEqual('no foobar allowed');

  });

  it("should pass validation", function(){

    var book = new Book();
    book.pages_number = 'ok';
    var errors = book.validate();

    expect( errors ).toEqual( true );

  });

  it("should not save the book caused by validation error", function(){
    var book = new Book();
    book.pages_number = 'foobar';

    expect( book.save() ).toEqual(false);

    book.pages_number = 2;
    expect( book.save() ).toEqual(true);

  });

});




describe("drop database", function(){
  it("it should drop the database", function(){
    expect( Query._executeQuery( "DROP DATABASE " + DATABASE) ).toBeTruthy();
  });

  it("it should close the connection", function(){
    expect( Adapter.close() ).toBeTruthy();
  });

});