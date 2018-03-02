[![Build Status](https://travis-ci.org/panderalabs/koa-pageable.svg?branch=master)](https://travis-ci.org/panderalabs/koa-pageable)
[![Greenkeeper badge](https://badges.greenkeeper.io/panderalabs/koa-pageable.svg)](https://greenkeeper.io/)

* [About](#about)
* [Overview](#overview)
  * [Request](#request)
    * [Query parameters](#query-parameters)
      * [Pageable](#pageable)
      * [Sort](#sort)
    * [Errors](#errors)
  * [Response](#response)
    * [All Page types](#all-page-types)
      * [Map Method](#map-method)
    * [ArrayPage](#arraypage)
    * [IndexedPage](#indexedpage)
    * [IndexablePage](#indexablepage)
    * [Output Format](#output-format)
      * [Non\-Indexed](#non-indexed)
      * [Indexed](#indexed)
* [Getting Started](#getting-started)
  * [Installation](#installation)
    * [npm](#npm)
    * [yarn](#yarn)
  * [Requirements](#requirements)
  * [Examples](#examples)
    * [Router](#router)
    * [Data Access](#data-access)
* [API Documentation](#api-documentation)

# About
`koa-pageable` is middleware for pagination in [Koa](https://github.com/koajs/koa) inspired by  [Spring Data](http://docs.spring.io/spring-data/commons/docs/current/reference/html/)'s Pagination support.

It allows clients of your API to easily request subsets of your data by providing query parameters to specify the amount, order, and formatting of the requested data. For instance, if you had an endpoint `/people` backed by a data store containing 1000 people records, `koa-pageable` allows a client to request the data be broken up into 10 person pages, and to receive 2nd page of people sorted by their lastname (`GET /people?page=1&size=10&sort=lastname`)

# Overview  
## Request 
### Query parameters
When enabled this middleware parses request query parameters from `ctx.query` into an instance of `Pageable`. 

**These values are:** 

Parameter | Default Value | Description  
----------|---------------|------------
`page`    | `0`           | The 0-indexed page to be retrieved 
`size`    | `10`          | Maximum number of elements to be included in the retrieved page  
`sort`    | `undefined`   | Properties that should be sorted, in the specified order. Properties are separated by a `,` and directions are separated with a `:`. Valid directions are `asc` and `desc` and if not specified, direction defaults to `asc`. For example to sort by `lastname` ascending, then `firstname` descending: `?sort=lastname,firstname:desc`|         
`indexed` | `false`       | If the underlying content supports it (i.e. has an `id` property) return results in indexed format. Which is an array of ids and a map of {id : content item}

#### Pageable
The `Pageable` object created from the query parameters contains two integers, `page` & `size`, an optional `Sort` instance, and an `indexed` boolean.
This `pageable` instance should  be passed to your data access layer, and its content should be used to restrict the returned data to the data specified by the `pageable`.

#### Sort
`Sort` is a collection of `property` and `direction`( `asc` or `desc`) pairs.
Each `sort` instance has a `forEach(callback(property,direction))` method that invokes `callback` for each `property`/`direction` pair in the `sort`  

### Errors
If the `page` or `size` query parameter are not specified as valid numbers, a `NumberFormatError` will be thrown. If the sort direction is specified as anything other than `asc` or `desc` (e.g. `sort=lastName:foo`) then an `InvalidSortError` will be thrown.

## Response
The data returned from a using this middleware should be an instance of a subclass of `Page`.  

### All Page types
All `Page` types contain the following properties:

Property           | Description
-------------------|------------
`number`           | The number of the current page (should match `pageable.page`)
`size`             | The number of elements requested to be included in the current page (should match `pageable.size`)
`numberOfElements` | The number of elements actually returned in this page. If < size, indicates that this is the last page
`totalElements`    | Total number of elements available
`totalPages`       | Total number of pages available
`sort`             | The sort criteria (should match `pageable.sort`)
`first`            | True if this is the first page 
`last`             | True if this is the final page 

You may have noticed that the above list does not define a property containing the actual content to be returned. 
This is because there are multiple `Page` implementations which represent the actual content items in different formats.

#### Map Method
All Page types also provide a `map(iteratee)` method. This method iterates over each content item in the page and invokes iteratee with the content item as the argument, 
allowing easy transformation from a `Page<X>` to a `Page<Y>`. This is useful, for instance, if you wish to return a different object 
from your `router` than the type returned from your data layer. 

### ArrayPage
A `Page` of content items represented as an array. An `ArrayPage` contains all of the properties above plus:

Property  | Description
----------|------------
`content` | Array of content ordered as per `pageable.sort`
  
### IndexedPage
An `IndexedPage` represents the returned content as an array of `ids` and a corresponding `index`, which is a map of `{id: content item}`.
An `IndexedPage` contains all of the standard page properties plus:

Property | Description
---------|------------
`ids`    | Array of ids ordered as per `pageable.sort`
`index`  | Map of id to content item  


### IndexablePage
An `IndexablePage` is a special case of `Page`, it internally stores its data in the same format as a `ArrayPage` but allows the client some level of control over the response structure.  
Upon serialization (i.e. invoking `toJSON()`) if the `pageable.indexed` value is set to `true`, the result will be serialized as an `IndexedPage` (else as an `ArrayPage`). 
In order to support this automatic conversion, the underlying content items _must_ each contain an `id` property.

### Output Format 

#### Non-Indexed
`GET /people?page=2&size=2&sort=firstname,lastname:desc&indexed=false`

```javascript
{            
  "number": 2,
  "size": 2,
  "sort": [
    {
      "direction": "asc",
      "property": "firstname"
    },
    {
      "direction": "lastname",
      "property": "desc"
    }
  ],
  "totalElements": 18,
  "totalPages": 9,
  "first": false,
  "last": false,
  "indexed": false,
  "content": [
    {
      "id": 202,
      "firstName": "Bob",
      "lastName": "Smith"
    },
    {
      "id": 200,
      "firstName": "Bob",
      "lastName": "Jones"
    }
  ],
  "numberOfElements": 2
}
```
#### Indexed
`GET /people?page=2&size=2&sort=firstname,lastname:desc&indexed=true`

```javascript
{
  "number": 2,
  "size": 2,
  "sort": [
    {
      "direction": "desc",
      "property": "id"
    },
    {
      "direction": "asc",
      "property": "createdTimestamp"
    }
  ],
  "totalElements": 18,
  "totalPages": 9,
  "first": false,
  "last": false,
  "ids": [
    202,
    200
  ],
  "index": {
    "200": {
      "id": 200,
      "firstName": "Frank",
      "lastName": "Jones"
    },
    "202": {
      "id": 202,
      "firstName": "Bob",
      "lastName": "Jones"
    }
  },
  "numberOfElements": 2
}
```

# Getting Started

## Installation
### npm
```
npm install @panderalabs/koa-pageable
```
### yarn
```
yarn add @panderalabs/koa-pageable
```

## Requirements
Requires `node` >= `8.2`, as `koa-pageable` makes use of async/await. [Flow](http://flowtype.org) bindings are also provided.   
Note: The following examples includes optional flow type annotations for clarity.

`koa-pageable` is a convenient library for managing conversion of user intent (via request parameters) into a `Pageable` object, but it is still your responsibility to implement that intention when accessing data. You are responsible for ensuring that your data access tier properly implements the pagination and/or sorting, and for creating the `Page` instances to be returned. The exact approach for doing so will differ based on your chose Data Access framework. 

## Examples
### Router
```javascript
// @flow
import { Pageable, IndexedPage, paginate } from '@panderalabs/koa-pageable';
import Koa from 'koa';

var app = new Koa();
app.use(paginate);

app.use(async ctx => {
  // the pageable created from query parameters will be stored in ctx.state.pageable
  const pageable: Pageable = ctx.state.pageable;
  // pass the pageable down into any service and data access tiers, and use its properties to retrieve the appropriate data and return it as a Page
  const result: IndexedPage<Person> = service.getData(pageable);
});
```

### Data Access
Example of using `pageable` as input to a query, and `Page` as the response type. 
This example is based on [Objection](http://vincit.github.io/objection.js/) but should be translatable to any data access / ORM framework.

```javascript
// @flow
import { IndexablePage, Pageable, Sort, } from '@panderalabs/koa-pageable';
import type { QueryBuilder } from 'objection';

function getData(pageable: Pageable): IndexablePage<Foo> {
  const pageNumber = pageable.page;
  const pageSize = pageable.size;
  const sort: Sort  = pageable.sort;
 
  const queryBuilder: QueryBuilder = Person.query().where('age', '>', 21).page(pageNumber, pageSize);
  
  //If there is a sort, add each order element to the query's `orderBy`
  if (sort) {
    sort.forEach((property, direction) => queryBuilder.orderBy(property, direction));
  }  
  const result = await query.execute();
  
  return new IndexablePage(result.results, result.total, pageable); 
}
```

# API Documentation
https://panderalabs.github.io/koa-pageable/
