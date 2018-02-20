// @flow
import type { Context } from 'koa';
import flatMap from 'lodash.flatmap';
import keyBy from 'lodash.keyby';
import isEmpty from 'lodash.isempty';
import mapValues from 'lodash.mapvalues';

/**
 * Base Class for error types thrown by Koa Paginate.
 *
 * @param message The human-readable message describing the error
 */
export class KoaPageableError extends Error {
  /**
   * HTTP Status code to be returned, 400
   */
  static status = 400;

  /**
   * Stack trace obtained via Error().stack
   */
  stack: string;

  /**
   * Human readable description of error
   */
  message: string;

  /**
   * Name of the error
   * @param message
   */
  name: string;

  constructor(message: string) {
    super(message);
    this.name = 'KoaPageableError';
    this.message = message;
    this.stack = new Error().stack;
  }
}

/**
 * Error type thrown when parsing Pagination parameters fails
 * @param message The human-readable message describing the error
 */
export class NumberFormatError extends KoaPageableError {
  static status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'NumberFormatError';
    this.message = message;
    this.stack = new Error().stack;
  }
}

/**
 * Error type thrown when an invalid Sort Direction is provided on the request.
 */
export class InvalidSortError extends KoaPageableError {
  static status = 400;

  constructor() {
    const msg = 'Invalid Sort Direction, must be one of "asc" or "desc"';
    super(msg);
    this.name = 'InvalidDirectionError';
    this.message = msg;
    this.stack = new Error().stack;
  }
}

/**
 * Converts the input into a number it it's a valid numeric string, otherwise it throws a NumberFormatError
 *
 * @param input Input to convert to number
 * @returns Numeric value of string
 */
function parseIntOrThrow(input: string): number {
  const result = parseInt(input, 10);

  if (typeof result !== 'number' || Number.isNaN(result)) {
    throw new NumberFormatError(`Could not convert '${input}' to number`);
  }
  return result;
}

/**
 * Converts the input to a number if it's a valid numeric string using {@link parseIntOrThrow}. If the input isn't
 * specified, returns null
 *
 * @param input Input to convert to number
 * @returns Null or numeric value of string
 */
function parseOptionalIntOrThrow(input: ?string): ?number {
  if (!input) {
    return null;
  }
  return parseIntOrThrow(input);
}

/**
 * Enumeration of sort directions
 * @type {{asc: string, desc: string}}
 * @enum {string}
 */
export const Direction = {
  asc: 'asc',
  desc: 'desc',
};

/**
 * Flow type for {@link Direction} enum
 */
export type DirectionType = $Keys<typeof Direction>;

/**
 * Pairing of a property and a {@link Direction}. Represents a single property that should be ordered as part of a
 * {@link Sort}
 * @param property The property to be ordered
 * @param direction The direction of the ordering, defaults to {@link Direction.asc}
 */
export class Order {
  direction: DirectionType;
  property: string;

  static _DEFAULT_DIRECTION = Direction.asc;

  constructor(property: string, direction: DirectionType = Order._DEFAULT_DIRECTION) {
    this.direction = Order._DEFAULT_DIRECTION;

    // only set it to desc if it's an exact match, else default
    if (direction.toLowerCase() === Direction.desc) {
      this.direction = Direction.desc;
    }

    this.property = property;
  }
}

/**
 * Function that converts between a string and a {@link Direction}
 * @param dir The string to convert into a typed {@link Direction}
 * @returns {DirectionType} If the parameter exactly matches "asc" or "desc" returns the corresponding
 * {@link Direction}. If dir is blank the default direction {@link Direction.asc} will be returned. Else an
 *   {@link InvalidSortError} is thrown
 */
function stringToDirection(dir: string): DirectionType {
  if (isEmpty(dir)) {
    return Order._DEFAULT_DIRECTION;
  }
  if (dir === Direction.asc) {
    return Direction.asc;
  } else if (dir === Direction.desc) {
    return Direction.desc;
  }
  throw new InvalidSortError();
}

/**
 * Sort options that should be applied to returned data set. Represents an iterable list of ordered properties.
 * @param orders Array of {@link Order} instances
 */
export class Sort {
  orders: Array<Order>;

  constructor(orders: Array<Order>) {
    this.orders = orders;
  }

  // $FlowFixMe - ignore until flow has support for computed properties. https://github.com/facebook/flow/issues/3460
  [Symbol.iterator]() {
    const values = Object.values(this.orders);
    let count = 0;
    let done = false;

    const next = () => {
      done = (count >= values.length);
      const value = values[count += 1];
      return { done, value };
    };
    return { next };
  }

  /**
   * Provides ability to execute Sort.forEach(...) and iterate over its contained list of {@link Order}s.
   *
   * @param iteratee Function invoked with and provided with each {@link Order}'s (property, direction) pair as
   *   arguments
   */
  forEach(iteratee: (property: string, direction: DirectionType) => *) {
    this.orders.forEach(it => iteratee(it.property, it.direction));
  }

  /**
   * Overrides default serialization to  serialize the orders directly instead of serializing the Sort with a nested
   * order list
   */
  toJSON(): Array<Order> {
    return this.orders;
  }
}

/**
 * Convert query param(s) into a Sort object. Supports both single (&foo=bar) and multi-value (&foo=bar&foo=baz) params
 *
 * @param sortRequestQuery Query param(s) to sort by
 * @returns Instance of Sort
 * @throws {@link InvalidSortError} if requested direction is not "asc" or "desc"
 */
function parseSort(sortRequestQuery: string | Array<string>): Sort {
  let paramArray: Array<string>;

  // Multi-value params - convert to flat list of string
  if (Array.isArray(sortRequestQuery)) {
    paramArray = flatMap(sortRequestQuery.map(it => it.split(',')));
  } else { // single param
    paramArray = sortRequestQuery.split(',');
  }

  // Ensure that only valid values are used (multiple commas are excluded).
  const validArray = paramArray.filter(param => (param.length > 0));

  const orderList = validArray.map((it) => {
    // Ensure that only valid values are used (if multiple colons were specified in error).
    const result = it.split(':').filter(value => (value.length > 0));
    return new Order(result[0], stringToDirection(result[1]));
  });

  return new Sort(orderList);
}

/**
 * Represents the configuration for a page of elements. Created by the middleware based on the request query parameters
 * @param pageNumber The page to be returned
 * @param pageSize The number of elements to be returned
 * @param indexed The format to return the results in.
 * If true and the type of the content being returned supports it (has an `id` property), the result will contain a
 *   (potentially ordered, based on `sort`) list of `ids` and a corresponding map of `{id: content item}`, else content
 *   returned as a simple array. Default value is false.
 * @param sort Optional. The order to return the results in, ordered list of property, {@link Direction}.
 */
export class Pageable {
  /**
   * The number of the Page to be returned
   */
  page: number;
  /**
   * The number of elements in the Page to be returned
   */
  size: number;
  /**
   * The order of the elements in the Page to be returned
   */
  sort: ?Sort;
  /**
   * If true and the type of the content being returned supports it (has an `id` property), the resulting {@link Page}
   * will be of type {@link IndexedPage} and will contain a
   *   (potentially ordered, based on `sort`) list of `ids` and a corresponding map of `{id : content item}`, else the
   * page will be of type {@ArrayPage} and content will be returned as a simple array.
   */
  indexed: boolean;

  constructor(
    pageNumber: number = 0,
    pageSize: number = 20,
    indexed: boolean = false,
    sort: ?string | ?Array<string> | Sort,
  ) {
    this.page = pageNumber;
    this.size = pageSize;
    this.indexed = indexed;

    if (sort) {
      if (sort instanceof Sort) {
        this.sort = sort;
      } else {
        this.sort = parseSort(sort);
      }
    }
  }
}

/**
 * "Base class" for container for content being returned.
 * @param totalElements The total number of elements in the data set
 * @param pageable The {@link Pageable} containing the paging information
 */
export class Page {
  /**
   * The number of the current page
   */
  number: number;

  /**
   * Size of the page (based on requested value)
   */
  size: number;

  /**
   * Number of elements in the current page
   */
  numberOfElements: number;

  /**
   * Total number of elements available
   */
  totalElements: number;

  /**
   * Total number of pages available
   */
  totalPages: number;

  /**
   * Sort of this page
   */
  sort: ?Sort;

  /**
   * True if this is the first page
   */
  first: boolean;

  /**
   * True if this is the last page in the available data set
   */
  last: boolean;

  constructor(totalElements: number, pageable: Pageable) {
    this.number = pageable.page;
    this.size = pageable.size;
    this.sort = pageable.sort;
    this.totalElements = totalElements;

    // calculated values
    this.totalPages = Math.max(Math.ceil(totalElements / this.size), 1);
    this.first = (this.number === 0);
    this.last = (this.number >= this.totalPages - 1);
  }
}

// Sadly documentation.js does not reasonably  handle inheritance
// (https://github.com/documentationjs/documentation/issues/390)  Can remove the duplicated constructor parameters on
// children of Page once the above is resolved.

/**
 * Represents a sublist of a list of objects. Provides details about the total list, including whether there is more
 * data available.
 * @param content The content to be returned
 * @param totalElements The total number of elements in the data set
 * @param pageable The {@link Pageable} containing the paging information
 */
export class ArrayPage<T> extends Page {
  /**
   * Array of content
   */
  content: Array<T>;

  constructor(content: Array<T> = [], totalElements: number, pageable: Pageable) {
    super(totalElements, pageable);
    this.content = content;
    this.numberOfElements = this.content.length;
  }

  /**
   * Returns a new Page created by invoking `iteratee` on each element in `content`
   *
   * @param iteratee Method to transform content elements
   * @returns Instance of Page
   */
  map<R>(iteratee: (T) => R): ArrayPage<R> {
    return new ArrayPage(
      this.content.map(iteratee),
      this.totalElements,
      new Pageable(this.number, this.size, false, this.sort),
    );
  }
}

/**
 * A page that has its content normalized into an array of ids and a corresponding map of `{id : content item }`
 * @param ids Array of content ids
 * @param index Map of Id to Content Items
 * @param totalElements The total number of elements in the data set
 * @param pageable The {@link Pageable} containing the paging information
 */
export class IndexedPage<I, T: ?Object> extends Page {
  /**
   * Array of Content Ids (ordered by `pageable.sort` if populated)
   */
  ids: Array<I>;

  /**
   * Map of `{id : content item}`
   */
  index: { [index: I]: T };

  constructor(ids: Array<I>, index: { [index: I]: T }, totalElements: number, pageable: Pageable) {
    super(totalElements, pageable);
    this.ids = ids;
    this.index = index;
    this.numberOfElements = Object.values(index).length;
  }

  /**
   * Returns a new {@link IndexedPage} created by running each element of `index` through iteratee
   * @param iteratee Method to transform content elements
   * @returns Transformed {@link IndexedPage}
   */
  map<R: ?Object>(iteratee: (T) => R): IndexedPage<I, R> {
    const mappedIndex = mapValues(this.index, iteratee);
    return new IndexedPage(
      this.ids,
      mappedIndex,
      this.totalElements,
      new Pageable(this.number, this.size, true, this.sort),
    );
  }
}

/**
 * Page type that can be serialized to json  as either an {@ArrayPage} or {@IndexedPage}.
 *
 * In order to achieve this, _all_ elements in the content array *must* have an `id` property.
 *
 * Then, upon serialization, if the `indexed` value is true, the content is grouped by `id` to obtain the map of `{id:
 * content item}` and  written as an {@link IndexedPage}, else it is written as an {@link ArrayPage}
 *
 * @param content The content to be returned
 * @param totalElements The total number of elements in the data set
 * @param pageable The {@link Pageable} containing the paging information
 */
export class IndexablePage<I, T: { id: I }> extends Page {
  content: Array<T>;
  indexed: boolean = false;

  constructor(content: Array<T> = [], totalElements: number, pageable: Pageable) {
    super(totalElements, pageable);
    this.content = content;
    this.indexed = pageable.indexed;
    this.numberOfElements = this.content.length;
  }

  /**
   * Returns a new {@link IndexablePage} created by running each element of `content` through iteratee
   * @param iteratee Method to transform content elements
   * @returns Transformed {@link IndexablePage}
   */

  map<R: { id: I }>(iteratee: (T) => R): IndexablePage<I, R> {
    return new IndexablePage(
      this.content.map(iteratee),
      this.totalElements,
      new Pageable(this.number, this.size, this.indexed, this.sort),
    );
  }

  /**
   * Json Serizliation that checks `indexed` property, and returns an {@link IndexedPage} if true, else
   * {@link ArrayPage}
   * @returns {Page}
   */
  toJSON(): Page {
    if (this.indexed) {
      const ids: Array<I> = this.content.map(it => it.id);
      const contentById: { [index: I]: ?T } = keyBy(this.content, 'id');
      return new IndexedPage(
        ids,
        contentById,
        this.totalElements,
        new Pageable(this.number, this.size, this.indexed, this.sort),
      );
    }
    return new ArrayPage(
      this.content,
      this.totalElements,
      new Pageable(this.number, this.size, this.indexed, this.sort),
    );
  }
}

/**
 * Koa Middleware function that reads pagination parameters from the query string, and populate `ctx.state.pageable`
 * with a {@link Pageable} instance.
 *
 * @param ctx Context associated with the Koa middleware function
 * @param next Middleware function called after {@link Pageable} property is set in state
 * @returns {Promise}
 */
export async function paginate(ctx: Context, next: Function) {
  const page = parseOptionalIntOrThrow(ctx.query.page) || 0;
  const size = parseOptionalIntOrThrow(ctx.query.size) || 10;
  const sort = ctx.query.sort || null;
  const indexed: boolean = (ctx.query.indexed === 'true');

  ctx.state.pageable = new Pageable(page, size, indexed, sort);
  return next();
}
