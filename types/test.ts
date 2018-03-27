// tslint:disable no-implicit-dependencies
import {
  Direction,
  Order,
  Sort,
  Page,
  IndexedPage,
  IndexablePage,
  Pageable,
  paginate,
} from '@panderalabs/koa-pageable';
// tslint:enable no-implicit-dependencies

const foo: Direction = 'foo'; // $ExpectError
const order = new Order('foo', 'asc');
order; // $ExpectType Order

const sort = new Sort([order]);
sort; // $ExpectType Sort

sort.toJSON(); // $ExpectType Order[]
sort.forEach(); // $ExpectError
sort.forEach((property, direction) => {
  property; // $ExpectType string
  direction; // $ExpectType Direction
});

const pageable = new Pageable(1, 2, true, 'asc');
pageable; // $ExpectType Pageable

const page = new Page<{}>([], 0, pageable);
page; // $ExpectType Page<{}>

page.map(() => 1); // $ExpectType Page<number>

const content = {
  a: 'foo',
  b: 'foobar',
  c: 'foobarbaz',
};
const indexed = new IndexedPage<string, string>(
  Object.keys(content),
  content,
  Object.keys(content).length,
  pageable,
);
indexed; // $ExpectType IndexedPage<string, string>

const indexable = new IndexablePage<string, {}>([{}], 0, pageable, 'foo');
indexable; // $ExpectType IndexablePage<string, {}>
