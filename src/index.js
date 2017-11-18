// inspired by commander.js

const optionRegex =  new RegExp("^(?:(-[a-z])?\\s?(--[a-z]{2,})?\\s?(\\[\\])?)$");
const argumentRegex = new RegExp("^(?:<([a-z]+)>)|(?:\\[([a-z]+)\\])$");

class Kommandr {
	constructor(name, option = {}){
		// option: {
		// 	aliases: ["foo", "bar"],
		// 	prefix: "!"
		// }

		if(!name){
			throw "You must define a command name";
		}
		this.commandName = name;
		this.aliases = option.aliases || [];
		this.matchRegex = new RegExp(
			`^${option.prefix ? option.prefix : "" }(?:${name}${option.aliases ? `|${option.aliases.join("|")}` : ""})(.*)$`
		);

		this.result = undefined;

		this.arguments = [];//[{argumentName, isRequired<bool>}]
		this.options = [];//[{singleCharacter, multiCharacter, argumentRequired<bool>, description}]

		this.eventListeners = {
			info: [],
			error: []
		}
	}

	// add option
	option(flags, description){
		// "-f"
		// "-f, --foo"
		// "-f, --foo [type]" = required arg
		let regexResult = optionRegex.exec(flags);
		if(!regexResult){
			throw "You must pass correct flags"
		}

		if(this.findOption(regexResult[1]) || this.findOption(regexResult[2])){
			throw "You cannot add the same option 2 times"
		}

		this.options.push({
			singleCharacter: regexResult[1],
			multiCharacter: regexResult[2],
			argumentRequired: regexResult[3] !== undefined,
			description: description || ""
		});

		return this;
	}

	// add argument
	argument(arg){
		// "<cmd>" = required arg
		// "[cmd]" = optional arg

		let regexResult = argumentRegex.exec(arg);
		if(!regexResult){
			throw "You must pass correct argument"
		}

		this.arguments.push({
			argumentName: regexResult[1]||regexResult[2],
			isRequired: regexResult[1] !== undefined
		});

		return this;
	}

	subCommand(name){
		// TODO
	}

	parse(toParse){
		// reset result
		this.result = undefined;

		let regexResult = this.matchRegex.exec(toParse);
		if(regexResult){
			if(regexResult[1].includes("-h") || regexResult[1].includes("--help")){
				this.info(this.help());
				return this.result;
			}

			// if regex match set result array
			this.result = [];
			let args = regexResult[1].trim().replace(/ +(?= )/g,'').split(" ");// remove multiple spaces and explode in array
			if(args){

				// replace -tar by "-t", "-a", "-r"
				let newArgs = [];
				args.forEach((arg, index, arr) => {
					if(arg.includes("-") && !arg.includes("--") && arg.length > 2){
						newArgs.push(...arg.slice(1).split("").map((x) => `-${x}`))
					}else{
						newArgs.push(arg);
					}
				});
				args = newArgs;

				// parse singlechar and multiplechar options
				let index = 0;
				while(index < args.length){
					// if there is singlechar options
					if(args[index].includes("-")){
						let findedOption = this.findOption(args[index]);
						if(!findedOption){
							return this.handleParseError(`Option invalide: ${args[index]}`);
						}

						let toPush;
						if(findedOption.argumentRequired){
							if(args.length <= index + 1){
								return this.handleParseError(`L'option: ${args[index]} requiert un argument`);
							}
							toPush = args.splice(index + 1, 1)[0];
						}else{
							toPush = true;
						}

						if(findedOption.singleCharacter){
							this.result[findedOption.singleCharacter.slice(1)] = toPush;
						}
						if(findedOption.multiCharacter){
							this.result[findedOption.multiCharacter.slice(2)] = toPush;
						}

						args.splice(index, 1);

					}else{
						index++;
					}
				}

				// parse arguments

				// get required arguments
				let requiredArguments = this.arguments.filter((argument) => argument.isRequired);

				// get not required arguments
				let notRequiredArguments = this.arguments.filter((argument) => !argument.isRequired);

				if(requiredArguments.length > args.length){
					return this.handleParseError("Il manque des arguments");
				}

				// parse requiredArguments first
				for(let currentArguments of [requiredArguments, notRequiredArguments]){
					index = 0;
					while(index < currentArguments.length){
						this.result[currentArguments[index]]
						index++;
					}

					currentArguments.forEach((argument) => {
						this.result[argument.argumentName] = args.shift();
					});
				}

				// if there is still args
				if(args.length !== 0){
					return this.handleParseError(`Il y a trop d'arguments: ${JSON.stringify(args)}`);
				}
			}
		}

		return this.result;
	}

	// iterate on this.arguments in right order (requiredArguments before notRequiredArguments)
	forEachArguments(callback){
		// get required arguments
		let requiredArguments = this.arguments.filter((argument) => argument.isRequired);

		// get not required arguments
		let notRequiredArguments = this.arguments.filter((argument) => !argument.isRequired);

		for(let currentArguments of [requiredArguments, notRequiredArguments]){
			for(let argument of currentArguments){
				callback(argument);
			}
		}
	}

	help(){
		let helpBuilder = [];

		let argumentsStringBegin = "";
		let argumentsStringEnd = "";
		for(let argument of this.arguments){
			if(argument.isRequired){
				argumentsStringBegin = `${argumentsStringBegin} <${argument.argumentName}>`;
			}else{
				argumentsStringEnd = `${argumentsStringEnd} [${argument.argumentName}]`;
			}
		}
		helpBuilder.push(`Usage: ${this.commandName}${this.options.length > 0 ? " [options]" : ""}${argumentsStringBegin}${argumentsStringEnd}`);

		if(this.aliases.length > 0){
			helpBuilder.push(`Aliases: ${this.aliases.join(", ")}`);
		}

		helpBuilder.push("");
		helpBuilder.push("Options:");

		let optionStrings = [];
		let longestOptionLength = 0;

		this.options.forEach((option) => {
			let optionString = `  ${option.singleCharacter ? option.singleCharacter : ""}${option.singleCharacter && option.multiCharacter ? ", " : ""}${option.multiCharacter ? option.multiCharacter : ""}${option.argumentRequired ? " [argument]" : ""}  `;
			longestOptionLength = longestOptionLength < optionString.length ? optionString.length : longestOptionLength;
			optionStrings.push(optionString);
		});

		optionStrings.forEach((optionString, index) => {
			helpBuilder.push(`${optionString.padEnd(longestOptionLength, " ")}${this.options[index].description}`);
		});


		return helpBuilder.join("\n");
	}

	handleParseError(errorText){
		this.result = undefined;
		this.error(errorText);
		return this.result;
	}

	// return matched option or null if undefined
	findOption(tag){
		let result;

		this.options.forEach((option) => {
			if(tag === option.singleCharacter || tag === option.multiCharacter){
				result = option
				return;
			}
		});

		return result;
	}

	on(level, callback){
		if(typeof callback !== "function"){
			throw "You must pass callback";
		}

		switch(level) {
			case "info":
				this.eventListeners.info.push(callback);
				break;
			case "err":
			case "error":
				this.eventListeners.error.push(callback);
				break;
			case "all":
				this.eventListeners.info.push(callback);
				this.eventListeners.error.push(callback);
				break;

		}

		return this;
	}

	notifyListener(level, text){
		this.eventListeners[level].forEach((callback) => {
			callback(text);
		});
	}

	// print info
	info(text){
		this.notifyListener("info", text);
	}

	// print error
	error(text){
		this.notifyListener("error", text);
	}

}

module.exports = Kommandr;
