$(document).ready(function(){
	$(".hideOnStartup").hide();

	$.getJSON("/protected", function(data){
		// Already authenticated
		$("#WhenAuthenticated").show();
		$("#sub").text(data.sub);
		$("#name").text(data.name || "Anonymous");
		$("#picture").attr("src", data.picture || "");
	}).fail(function(){
		// Not authenticated yet
		$("#WhenNotAuthenticated").show();
	}).always(function(){
		$("#LoginButtons").show();
	});
});