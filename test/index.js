'use strict';

// Load modules

const Code = require('code');
const Hoek = require('hoek');
const Lab = require('lab');
const Podium = require('..');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.experiment;
const it = lab.it;
const expect = Code.expect;


describe('Podium', () => {

    it('emits events', (done) => {

        const emitter = new Podium(['a', 'b', 'c', 'd']);

        const updates = [];

        emitter.on('a', (data) => updates.push({ a: data, id: 1 }));

        const handler2 = (data) => updates.push({ b: data, id: 2 });
        emitter.on('b', handler2);

        emitter.on('a', (data) => updates.push({ a: data, id: 3 }));
        emitter.on('c', (data) => updates.push({ c: data, id: 4 }));
        emitter.on('a', { count: 2 }, (data) => updates.push({ a: data, id: 5 }));

        expect(emitter.hasListeners('a')).to.be.true();

        emitter.emit('a', 1);
        emitter.emit('a', 2);
        emitter.emit('b', 3);
        emitter.emit('d', 4);
        emitter.emit('b', 5);
        emitter.emit('d', 6, () => {

            emitter.removeListener('b', handler2);
            emitter.removeListener('a', Hoek.ignore);
            emitter.removeListener('d', Hoek.ignore);

            emitter.emit('a', 7);
            emitter.emit('b', 8, () => {

                emitter.removeAllListeners('a');
                emitter.removeAllListeners('d');

                expect(emitter.hasListeners('a')).to.be.false();

                emitter.emit('a', 9, () => {

                    expect(updates).to.equal([
                        { a: 1, id: 1 },
                        { a: 1, id: 3 },
                        { a: 1, id: 5 },
                        { a: 2, id: 1 },
                        { a: 2, id: 3 },
                        { a: 2, id: 5 },
                        { b: 3, id: 2 },
                        { b: 5, id: 2 },
                        { a: 7, id: 1 },
                        { a: 7, id: 3 }
                    ]);

                    done();
                });
            });
        });
    });

    it('clones data for every handler', (done) => {

        const update = { a: 1 };

        const emitter = new Podium({ name: 'test', clone: true });
        emitter.on('test', (data) => {

            expect(data).to.not.shallow.equal(update);
            done();
        });

        emitter.emit('test', update);
    });

    it('can be inherited from', (done) => {

        class Sensor extends Podium {
            constructor(type) {

                super(type);
                this._type = type;
            }
            reading(data, next) {

                this.emit(this._type, data, next);
            }
        }

        class Thermometer extends Sensor {
            constructor() {

                super('temperature');
            }
        }

        class Hydrometer extends Sensor {
            constructor() {

                super('gravity');
            }
        }

        const thermometer = new Thermometer();
        const hydrometer = new Hydrometer();

        thermometer.on('temperature', { block: 10 }, (temperature, next) => {

            expect(temperature).to.equal(72);
            next();
        });

        hydrometer.on('gravity', { block: 10 }, (gravity, next) => {

            expect(gravity).to.equal(7);
            next();
        });

        thermometer.reading(72, () => {

            hydrometer.reading(7, done);
        });
    });

    describe('emit()', () => {

        it('returns callbacks in order added', (done) => {

            const emitter = new Podium(['a', 'b']);

            const updates = [];

            const aHandler = (data, next) => {

                updates.push({ a: data, id: 1 });
                setTimeout(next, 50);
            };

            emitter.on('a', { block: true }, aHandler);

            const bHandler = (data) => {

                updates.push({ b: data, id: 1 });
            };

            emitter.on('b', bHandler);

            emitter.emit('a', 1, () => updates.push('a done'));
            emitter.emit('b', 1, () => {

                expect(updates).to.equal([{ a: 1, id: 1 }, 'a done', { b: 1, id: 1 }]);
                done();
            });
        });

        it('times out on blocked handler', (done) => {

            const emitter = new Podium(['a', 'b']);

            const updates = [];

            const aHandler = (data, next) => {

                updates.push({ a: data, id: 1 });
            };

            emitter.on('a', { block: 50 }, aHandler);

            const bHandler = (data) => {

                updates.push({ b: data, id: 1 });
            };

            emitter.on('b', bHandler);

            emitter.emit('a', 1, () => updates.push('a done'));
            emitter.emit('b', 1, () => {

                expect(updates).to.equal([{ a: 1, id: 1 }, 'a done', { b: 1, id: 1 }]);
                done();
            });
        });

        it('removes handlers while notifications pending', (done) => {

            const emitter = new Podium(['a', 'b']);

            const updates = [];

            const aHandler = (data, next) => {

                updates.push({ a: data, id: 1 });
                setTimeout(() => {

                    emitter.removeAllListeners('b');
                    return next();
                }, 50);
            };

            emitter.on('a', { block: true }, aHandler);

            const bHandler = (data) => {

                updates.push({ b: data, id: 1 });
            };

            emitter.on('b', bHandler);

            emitter.emit('a', 1, () => updates.push('a done'));
            emitter.emit('b', 1, () => {

                expect(updates).to.equal([{ a: 1, id: 1 }, 'a done']);
                done();
            });
        });

        it('invokes all handlers subscribed to an event', (done) => {

            const emitter = new Podium('test');
            let handled = 0;
            emitter.on('test', () => {

                handled++;
            });

            emitter.on('test', () => {

                handled++;
            });

            emitter.on('test', () => {

                handled++;
            });

            emitter.emit('test', null, () => {

                expect(handled).to.equal(3);
                done();
            });
        });
    });

    describe('on()', () => {

        it('invokes a handler everytime the subscribed event occurs', (done) => {

            const emitter = new Podium('test');
            let handled = 0;
            emitter.on('test', () => {

                handled++;
            });

            emitter.emit('test');
            emitter.emit('test');
            emitter.emit('test', null, () => {

                expect(handled).to.equal(3);
                done();
            });
        });

        it('clones data', (done) => {

            const update = { a: 1 };

            const emitter = new Podium('test');
            emitter.on('test', { clone: true }, (data) => {

                expect(data).to.not.shallow.equal(update);
                done();
            });

            emitter.emit('test', update);
        });
    });

    describe('addListener()', () => {

        it('invokes a handler everytime the subscribed event occurs', (done) => {

            const emitter = new Podium('test');
            let handled = 0;
            emitter.addListener('test', () => {

                handled++;
            });

            emitter.emit('test');
            emitter.emit('test');
            emitter.emit('test', null, () => {

                expect(handled).to.equal(3);
                done();
            });
        });
    });

    describe('once()', () => {

        it('invokes a handler once', (done) => {

            const emitter = new Podium('test');
            let counter = 0;
            emitter.once('test', () => ++counter);
            emitter.emit('test');
            emitter.emit('test');
            emitter.emit('test', null, () => {

                expect(counter).to.equal(1);
                done();
            });
        });

        it('invokes a handler once with options', (done) => {

            const emitter = new Podium('test');
            let counter = 0;
            emitter.once('test', { block: true }, (data, next) => {

                ++counter;
                return next();
            });

            emitter.emit('test');
            emitter.emit('test');
            emitter.emit('test', null, () => {

                expect(counter).to.equal(1);
                done();
            });
        });
    });

    describe('removeListener()', () => {

        it('deletes a single handler from being subscribed to an event', (done) => {

            const emitter = new Podium('test');
            let handled = 0;
            const handler = () => {

                handled++;
            };
            emitter.addListener('test', handler);

            emitter.emit('test', null, () => {

                emitter.removeListener('test', handler);
                emitter.emit('test', null, () => {

                    expect(handled).to.equal(1);
                    done();
                });
            });
        });
    });

    describe('removeAllListeners()', () => {

        it('deletes all handlers from being subscribed to an event', (done) => {

            const emitter = new Podium('test');
            let handled = 0;
            emitter.on('test', () => {

                handled++;
            });

            emitter.on('test', () => {

                handled++;
            });

            emitter.on('test', () => {

                handled++;
            });

            emitter.emit('test', null, () => {

                emitter.removeAllListeners('test');
                emitter.emit('test', null, () => {

                    expect(handled).to.equal(3);
                    done();
                });
            });
        });
    });

    describe('registerEvent()', () => {

        it('combines multiple sources', (done) => {

            const source = new Podium();
            const emitter = new Podium('a');
            emitter.registerPodium(source);

            source.registerEvent(['a', 'b', null]);

            let counter = 0;
            emitter.on('b', (data) => {

                expect(data).to.equal(1);
                if (++counter === 2) {
                    done();
                }
            });

            source.emit('b', 1);
            source.emit('b', 1);
        });
    });

    describe('registerPodium()', () => {

        it('combines multiple sources', (done) => {

            const source1 = new Podium('test');
            const source2 = new Podium('test');

            const emitter = new Podium();
            emitter.registerPodium(source1);
            emitter.registerPodium(source2);

            let counter = 0;
            emitter.on('test', (data) => {

                ++counter;
                expect(data).to.equal(1);
            });

            source1.emit('test', 1);
            source2.emit('test', 1, () => {

                expect(counter).to.equal(2);
                done();
            });
        });

        it('ignores repeated registrations', (done) => {

            const source = new Podium('test');
            const emitter = new Podium();
            emitter.registerPodium(source);
            emitter.registerPodium(source);

            let counter = 0;
            emitter.on('test', (data) => ++counter);

            source.emit('test', null, () => {

                expect(counter).to.equal(1);
                done();
            });
        });

        it('combines multiple sources in constructor', (done) => {

            const source1 = new Podium('test');
            const source2 = new Podium('test');

            const emitter = new Podium([source1, source2]);

            let counter = 0;
            emitter.on('test', (data) => {

                expect(data).to.equal(1);
                if (++counter === 2) {
                    done();
                }
            });

            source1.emit('test', 1);
            source2.emit('test', 1);
        });

        it('combines multiple sources in constructor and after', (done) => {

            const source1 = new Podium('test');
            const source2 = new Podium('test');

            const emitter = new Podium(source1);
            emitter.registerPodium(source2);

            let counter = 0;
            emitter.on('test', (data) => {

                expect(data).to.equal(1);
                if (++counter === 2) {
                    done();
                }
            });

            source1.emit('test', 1);
            source2.emit('test', 1);
        });

        it('combines multiple sources with own emit', (done) => {

            const source1 = new Podium('test');
            const source2 = new Podium('test');

            const emitter = new Podium();
            emitter.registerPodium(source1);
            emitter.registerPodium(source2);

            let counter = 0;
            emitter.on('test', (data) => {

                expect(data).to.equal(1);
                if (++counter === 3) {
                    done();
                }
            });

            source1.emit('test', 1);
            emitter.emit('test', 1);
            source2.emit('test', 1);
        });

        it('adds sources after listeners', (done) => {

            const source1 = new Podium('test');
            const source2 = new Podium('test');

            const emitter = new Podium('test');

            let counter = 0;
            emitter.on('test', (data) => {

                expect(data).to.equal(1);
                if (++counter === 2) {
                    done();
                }
            });

            emitter.registerPodium(source1);
            emitter.registerPodium(source2);

            source1.emit('test', 1);
            source2.emit('test', 1);
        });

        it('subscribed multiple times', (done) => {

            const source1 = new Podium('test');
            const source2 = new Podium('test');

            const emitter = new Podium('test');

            let counter = 0;
            emitter.on('test', () => {

                ++counter;
            });

            emitter.on('test', () => {

                counter = counter * 4;
            });

            emitter.registerPodium(source1);
            emitter.registerPodium(source2);

            source1.emit('test');
            source2.emit('test', null, () => {

                expect(counter).to.equal(20);
                done();
            });
        });
    });
});
