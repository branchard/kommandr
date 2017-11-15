// inspired by commander.js
class Kommandr {
	constructor(name){
		if(name){
			this.commandName = name;
		}
	}

	name(name){
		this.commandName = name;

		return this;
	}

	option(arg, argv){

	}

	parse(input){

	}

	// TODO add listener
	on(arg, callback){
		switch(arg) {
			case "output":
				callback("foo");
				break;

		}

		return this;
	}

}

module.exports.Kommandr;
