module.exports = (function () {

    function getSafe(fn, defaultVal) {
        try {
            return fn();
        } catch (e) {
            return defaultVal;
        }
    }
      
    function jsonToURLencodedForm(srcjson){
        if(typeof srcjson !== "object")
            if(typeof console !== "undefined"){
            console.log("\"srcjson\" is not a JSON object");
            return null;
        }
    
        let u = encodeURIComponent;
        let urljson = "";
        let keys = Object.keys(srcjson);
        for(var i=0; i <keys.length; i++){
            urljson += u(keys[i]) + "=" + u(srcjson[keys[i]]);
            if(i < (keys.length-1))urljson+="&";
        }
        return urljson;
    }

    function parseJSON(jsonStr) {
		try {
			var json = JSON.parse(jsonStr);
			return json;
		} catch (e) {
			return jsonStr;
		}
	}	
    
    return {
        getSafe,
        jsonToURLencodedForm,
        parseJSON
    };

}());