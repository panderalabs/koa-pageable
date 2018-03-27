// TypeScript Version: 2.4
// Project: Koa Pageable
// Definitions by: Wolf Rourke <wolf@panderalabs.com>
import * as Koa from 'koa';
import { flatMap, keyBy, mapValues } from 'lodash';

export enum Direction {
  asc = 'asc',
  desc = 'desc',
}

export class Order {
  static DEFAULT_DIRECTION: string;

  direction: Direction;
  property: string;
  constructor(property: string, direction?: Direction | string);
}

export class Sort {
  orders: Order[];
  constructor(orders: Order[]);
  [Symbol.iterator]: any;
  forEach(iteratee: (property: string, direction: Direction) => any): void;
  toJSON(): Order[];
}

export class Pageable {
  indexed: boolean;
  page: number;
  size: number;
  sort: Sort | null;
  constructor(
    pageNumber: number,
    pageSize: number,
    indexed: boolean,
    sort: string | string[] | Sort | null,
  );
}

export class Page<T> extends BasePage {
  content: T[];
  constructor(content: T[], totalElements: number, pageable: Pageable);
  map<R>(iteratee: (_: T) => R): Page<R>;
}

export class BasePage {
  first: boolean;
  last: boolean;
  number: number;
  numberOfElements: number;
  size: number;
  sort: any;
  totalElements: number;
  totalPages: number;
  constructor(totalElements: number, pageable: Pageable);
}

export class IndexedPage<I extends string, T> extends BasePage {
  ids: I[];
  index: { [key: string]: T | null };
  constructor(
    ids: I[],
    index: { [k in I]: T | null }, // TODO: This generic is not working as hoped
    totalElements: number,
    pageable: Pageable,
  );
  map<R>(iteratee: (_: T) => R | null): IndexedPage<I, R | null>;
}

export class IndexablePage<I extends string, T> extends BasePage {
  content: T[];
  indexed: boolean;
  indexedProperty: string;
  constructor(
    content: T[],
    totalElements: number,
    pageable: Pageable,
    indexedProperty: string,
  );
  map<R>(iteratee: (_: T) => R): IndexablePage<I, R>;
  toJSON(): BasePage;
}

export class NumberFormatError extends Error {
  message: string;
  name: string;
  stack: string;
  status: number;
  constructor(message: string);
}

export interface IteratorResult {
  done: boolean;
  value: any;
}

export function paginate(
  ctx: Koa.Context,
  next: (value?: any) => IteratorResult,
): Promise<any>;
