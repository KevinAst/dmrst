// simple test of ES Modules -AND- symbolic links into core (making sure nodemon follows these links)

import logger from './core/util/logger';
const  log = logger('vit:server:main');

import SmartModel from './core/domain/SmartModel';
import SmartComp  from './core/domain/SmartComp';

const a = 'Hello';
log(`${a} World ... string substitution works`);

const myModel = new SmartModel({msg: 'WowZee'});
log(`myModel instantiation ... ${myModel.sayIt()}`);

const myComp = new SmartComp({msg: 'WowWoo'});
log(`myComp instantiation ... ${myComp.sayIt()}`);

log('This concludes our test!\n\n');
