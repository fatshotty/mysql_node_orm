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

    expect( Book.declared_fields ).toBeDefined();
    expect( Book.__class_name__ ).toBeDefined();
    expect( Book._table_name ).toEqual('books');

  });

});


describe("Finding authors",function(){

  it("It should contain no Authors", function(){

    var authors = Author.find('all');
    expect( authors ).toBeDefined();
    expect( authors.__class_name__ ).toBeDefined();
    expect( authors.length ).toBeDefined();
    expect( authors.length ).toEqual(0);


  });

  it("It should contain no Books", function(){

    var books = Book.find('all');
    expect( books ).toBeDefined();
    expect( books.__class_name__ ).toBeDefined();
    expect( books.length ).toBeDefined();
    expect( books.length ).toEqual(0);

  });

});

describe("Author creation",function(){

  it("It should create the first Author", function(){

    var author = new Author({
      name: 'First author',
      age: 45
    });

    expect( author.save() ).toBeTruthy();
    expect( author.id ).toEqual(1);

  });

  it("It should load the author", function(){

    var authors = Author.find('all');
    var firstAuthor = Author.find('first');
    var author = Author.find(1);


    expect( authors.length ).toBeDefined();
    expect( authors.length ).toEqual(1);
    expect( authors[0].id ).toEqual( firstAuthor.id );
    expect( author.id ).toEqual( authors[0].id );
    expect( author.id ).toEqual( firstAuthor.id );

  });


  it("Author should contain no books", function(){

    var author = Author.find(1);

    expect( author.books ).toBeDefined();
    expect( author.books.length ).toEqual(0);

  });

});




describe("Relations", function(){
  var author=null, book;
  it("it shoud create a new Author with id 2", function(){

    var author = new Author({
      name: 'Second author',
      age: 25
    });

    expect( author.save() ).toBeTruthy();
    expect( Author.find(2).age ).toEqual( 25 );

  });


  it("a new book should be related to the first author", function(){
    author = Author.find(1);
    book = new Book({
      name: 'first book of the first author',
      pages_number: 3098
    });


    expect( author.books.length ).toEqual(0);
    author.books.push( book );
    expect( author.books.length ).toEqual(1);
  });

  it("book's inheritance methods", function(){

    expect( book.foo ).toBeDefined();
    expect( book.test ).toBeDefined();
    expect( book.foo('test') ).toEqual('foobar test');

  });


  it("it should save the first author without saving the book",function(){
    expect( author.save() ).toBeTruthy();
    var a = Author.find(1);
    expect( a.books.length ).toEqual(0);
  });

  it("it should save the first author with one book",function(){
    // NOTE: the boolean parameter forces to save also the relations
    expect( author.save(true) ).toBeTruthy();
    var a = Author.find(1);
    expect( a.books.length ).toEqual(1);
  });

});

describe("the second author should have the first book", function(){

  var author = null, book, books;


  it("the second author should still have no book", function(){
    author = Author.find(2);
    expect( author.books.length ).toEqual(0);
  });



  it("should exist one book", function(){
    books = Book.find_by_author_id( 1 );
    expect( books.length ).toEqual( 1 );
  });


  it("the first book should be related to the first author",function(){
    book = books[0];
    expect( book ).toBeDefined();
    expect( book.author_id ).toEqual(1);
  });


  it("book should be related to the second author", function(){

    author.books.push( book );
    expect( book.author_id ).toEqual( 2 );

  });

  it("the second author and its books should be saved", function(){
    // NOTE: the boolean parameter forces to save all relations
    expect( author.save(true) ).toBeTruthy();

  });


  it("the first author should have no books", function(){
    var author = Author.find(1);
    expect( author.books.length ).toEqual(0);
  });

  it("the second author should have one book", function(){
    var author = Author.find(2);
    expect( author.books.length ).toEqual(1);
  });


});


describe("Deleting authors and books", function(){

  it("the first author should be deleted", function(){

    var author = Author.find(1);

    expect( author.delete() ).toBeTruthy();
    expect( Author.find(1) ).toBeFalsy();

  });


  it("All authors and their books should be deleted", function(){

    var author = Author.find(2);

    // NOTE: the boolean parameter forces to delete also the relations
    expect( author.delete(true) ).toBeTruthy();

    var book = Book.find('first');
    expect( book ).toBeNull();

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