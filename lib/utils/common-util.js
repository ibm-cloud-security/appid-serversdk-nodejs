module.exports = (function () {
    function jsonToURLencodedForm(srcjson){
        let u = encodeURIComponent;
        let urljson = "";
        let keys = Object.keys(srcjson);
        for(var i=0; i <keys.length; i++){
            urljson += u(keys[i]) + "=" + u(srcjson[keys[i]]);
            if(i < (keys.length-1))urljson+="&";
        }
        return urljson;
    }

    function parseJSON(jsonObj) {
		try {
			var json = JSON.parse(jsonObj);
			return json;
		} catch (e) {
			return jsonObj;
		}
	}	
    
    return {
        jsonToURLencodedForm,
        parseJSON
    };

}());