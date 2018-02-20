// flow
/* eslint-disable no-restricted-syntax */
import {
  Direction,
  ArrayPage,
  IndexablePage,
  IndexedPage,
  Order,
  Pageable,
  Sort,
  NumberFormatError,
  InvalidSortError,
  paginate,
} from '../index';


describe('Tests', () => {
  const orders = [
    new Order('propertyA', Direction.asc),
    new Order('propertyB', Direction.desc),
    new Order('propertyC', Direction.asc),
    new Order('propertyD', Direction.desc),
    new Order('propertyE', Direction.desc),
  ];

  const pageOrders = [
    new Order('firstName', 'asc'),
    new Order('lastName', 'asc'),
  ];

  const content = [
    { id: 1, firstName: 'Bob', lastName: 'Stevens' },
    { id: 2, firstName: 'Steve', lastName: 'Bobbins' },
    { id: 3, firstName: 'Robert', lastName: 'Stevenson' },
    { id: 4, firstName: 'Stevarino', lastName: 'Robertson' },
  ];

  describe('Order class', () => {
    it('returns "asc" for the static _DEFAULT_DIRECTION class property', () => {
      expect(Order._DEFAULT_DIRECTION).toEqual('asc');
    });

    it('instance.direction returns "asc" if no direction is specified in constructor', () => {
      const order = new Order('testProp');
      expect(order.direction).toEqual('asc');
    });

    it('instance.direction returns "desc" if direction parameter exactly matches "desc" in constructor', () => {
      const order = new Order('testProp', 'desc');
      expect(order.direction).toEqual('desc');
    });
  });

  describe('Sort class', () => {
    it('instance.toJSON() method result matches snapshot', () => {
      const sort = new Sort(orders);
      expect(sort.toJSON()).toMatchSnapshot();
    });

    it('iterates over orders using for...of loop', () => {
      const sort = new Sort(orders);
      const result = [];
      for (const order of sort) {
        result.push(order);
      }
      expect(result).toMatchSnapshot();
    });

    it('instance.forEach() method result matches snapshot', () => {
      const sort = new Sort(orders);
      const valueGroups = {
        properties: [],
        directions: [],
      };
      const iteratee = (property, direction) => {
        valueGroups.properties.push(property);
        valueGroups.directions.push(direction);
      };
      sort.forEach(iteratee);
      expect(valueGroups).toMatchSnapshot();
    });
  });

  describe('Pageable class', () => {
    it('default values match snapshot when constructor parameters are undefined', () => {
      const pageable = new Pageable();
      expect(pageable).toMatchSnapshot();
    });

    [
      { value: 'singleValue', type: 'string' },
      { value: ['valueA', 'valueB:desc', 'valueC:desc'], type: 'array of strings' },
      { value: new Sort(orders.slice(1, 3)), type: 'sort' },
    ].forEach(({ value, type }) => {
      it(`returns a valid Sort instance when a value of type ${type} is passed to the constructor`, () => {
        const pageable = new Pageable(1, 10, true, value);
        expect(pageable.sort).toMatchSnapshot();
      });
    });

    it('disregards extra commas in the sort array passed in as a parameter', () => {
      const invalidSort = ['valueA,', 'valueB,,', 'valueC,,,'];
      const result = new Pageable(0, 20, false, invalidSort);
      const invalidValues = result.sort.orders.filter(order => (order.property.length === 0));
      expect(invalidValues).toHaveLength(0);
    });

    it('disregards extra colons in the sort array passed in as a parameter', () => {
      const invalidSort = ['valueA:desc', 'valueB::desc', 'valueC::::desc'];
      const pageable = new Pageable(0, 20, false, invalidSort);
      const invalidValues = pageable.sort.orders.filter(order => (order.property.length === 0));
      expect(invalidValues).toHaveLength(0);
    });
  });

  describe('ArrayPage class', () => {
    const getValidPage = () => {
      const sort = new Sort(pageOrders);
      const pageable = new Pageable(0, 20, false, sort);
      return new ArrayPage(content, 2, pageable);
    };

    it('matches snapshot when valid parameters are passed to the constructor', () => {
      const result = getValidPage();
      expect(result).toMatchSnapshot();
    });

    it('results of instance.map() method result matches snapshot', () => {
      const page = getValidPage();
      const result = page.map((pageContent, idx) => ({ ...pageContent, age: (idx * 5) }));
      expect(result).toMatchSnapshot();
    });
  });

  describe('IndexedPage class', () => {
    const getValidIndexedPage = () => {
      const sort = new Sort(pageOrders);
      const pageable = new Pageable(0, 20, false, sort);
      const ids = [1, 2];
      const index = content.reduce((acc, record) => ({ ...acc, [record.id]: record }), {});
      return new IndexedPage(ids, index, 2, pageable);
    };

    it('matches snapshot when valid parameters are passed to the constructor', () => {
      const result = getValidIndexedPage();
      expect(result).toMatchSnapshot();
    });

    it('results of instance.map() method result matches snapshot', () => {
      const page = getValidIndexedPage();
      const result = page.map((pageContent, idx) => ({ ...pageContent, age: (idx * 5) }));
      expect(result).toMatchSnapshot();
    });
  });

  describe('IndexablePage class', () => {
    const getValidIndexablePage = (isIndexed = false) => {
      const sort = new Sort(pageOrders);
      const pageable = new Pageable(0, 20, isIndexed, sort);
      return new IndexablePage(content, 2, pageable, 'id');
    };

    it('matches snapshot when valid parameters are passed to the constructor', () => {
      const result = getValidIndexablePage();
      expect(result).toMatchSnapshot();
    });

    it('results of instance.map() method result matches snapshot', () => {
      const page = getValidIndexablePage();
      const result = page.map((pageContent, idx) => ({ ...pageContent, age: (idx * 5) }));
      expect(result).toMatchSnapshot();
    });

    it('instance.toJSON() method result matches snapshot', () => {
      const page = getValidIndexablePage(true);
      const result = page.toJSON();
      expect(result).toMatchSnapshot();
    });
  });

  describe('paginate function', () => {
    const next = () => {};
    const context = {
      query: {
        page: 1,
        size: 20,
        sort: 'firstName',
        indexed: 'true',
      },
      state: {},
    };

    it('context.state matches snapshot when paginate is called with valid context', async () => {
      await paginate(context, next);
      expect(context.state).toMatchSnapshot();
    });

    it('context.state matches snapshot when paginate is called with string values for page and size', async () => {
      const updatedQuery = { ...context.query, page: '10', size: '15' };
      await paginate({ ...context, query: updatedQuery }, next);
      expect(context.state).toMatchSnapshot();
    });

    it('context.state matches snapshot when paginate is called with empty strings for page and size', async () => {
      const updatedQuery = { ...context.query, page: '', size: '' };
      await paginate({ ...context, query: updatedQuery }, next);
      expect(context.state).toMatchSnapshot();
    });

    it('context.state matches snapshot when paginate is called with undefined page, size, and sort', async () => {
      const updatedQuery = { indexed: 'true' };
      await paginate({ ...context, query: updatedQuery }, next);
      expect(context.state).toMatchSnapshot();
    });

    it('throws error when paginate is called with invalid values for page and size', async () => {
      const updatedQuery = { ...context.query, page: 'page', size: 'size' };
      try {
        await paginate({ ...context, query: updatedQuery }, next);
      } catch (e) {
        expect(e).toBeInstanceOf(NumberFormatError);
      }
    });

    it('throws error when invalid sort direction is provided', async () => {
      const updatedQuery = { ...context.query, sort: 'firstName:foo' };
      try {
        await paginate({ ...context, query: updatedQuery }, next);
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidSortError);
      }
    });
  });
});
