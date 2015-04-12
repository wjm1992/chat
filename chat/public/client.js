var messages = [];
var socket;
var field;
var sendButton ;
var content;
var name;
var loginButton;
var groupId = -1;
var username
var sendMediaButton;

function getExtension(filename)
{
	var parts = filename.split(".");
	return parts[parts.length-1];
}

function isImage(file)
{
	var ext = getExtension(file.name);
	switch(ext.toLowerCase())
	{
	case 'jpg':
	case 'jpeg':
	case 'bmp':
	case 'png':
	case 'gif':
		return true;
	}
	
	return false;
}

function isVideo(file)
{
	var ext = getExtension(file.name);
	switch(ext.toLowerCase())
	{
	case 'mov':
	case 'mp4':
	case 'avi':
	case 'mpg':
	case 'm4v':
		return true;
	}
	
	return false;
}

var sitePath = "http://54.187.54.107:80";

window.onload = function() {
	socket = io.connect(sitePath);
	field = document.getElementById("field");
	sendButton = document.getElementById("send");
	content = document.getElementById("content");
	name = document.getElementById("name");
	loginButton = document.getElementById("login");
	sendMediaButton = document.getElementById("sendMedia");
	
	socket.on('alertError',function(data){
		alert(data.error);
	});
	
	socket.on('message', function(data){
		//if(data.message)
		//{
			messages.push(data);
			var html = '';
			var current;
			for(var i=0;i<messages.length;i++)
			{
				current = messages[i];
				html += '<b>' + (current.username ? current.username : 'Server') + ': </b>';
				if(current.image == true)
				{
					html += "<img class=\"msgImage\" src=\'"+current.buffer+"\'/><br/>"
				}
				else
				{
					if(current.video == true)
					{
						//html += "<a href=\""+sitePath+current.link+"\">"+current.filename+"</a><br/>";
						html += "<video class=\'msgVideo\' width=\"400px\" controls><source src=\""+sitePath+current.link+"\" type=\""+current.filetype+"\"></video><br/>";
					}
					else
						html += current.message+'<br/>';
				}
				
			}
			content.innerHTML = html;
			content.scrollTop = content.scrollHeight;
			/*}
			else
			{
			console.log("There is a problem: ",data);
			}*/
	});
	
	sendButton.onclick = function() {
		if(username == "")
		{
			alert("Please type your name!");
		}
		else
		{
			var text = field.value;
			socket.emit('send',{message: text, username: username,group:groupId});
			field.value = "";
		}
	};
	
	loginButton.onclick = function loginClicked()
	{
	
		var nameField = document.getElementById("name");
		if(nameField.value == "")
			return;
	
		username = nameField.value;
		socket.emit('login',{username:username});
	};
	
	socket.on('loginResult',function(data){
		displayLogin(data.result);
	});
	
	function addUserInGroup(nameVal)
	{
		var node = document.createElement("div");
		var text = document.createTextNode(nameVal);
		node.appendChild(text);
		
		var memberList = document.getElementById("members");
		
		node.className = "chatMember";
		memberList.appendChild(node);
	}
	
	function displayGroupMembers(members,admin)
	{
		var len = members.length;
		var html = "";
		
		for(var i=0;i<len;i++)
		{
			html+="<div class=\"chatMember\">"+members[i];
			
			if(members[i]==admin)
			{
				html+="(admin)";
				if(members[i] == username)
				{
					html+="(self)";
				}
			}
			else
			{
				if(members[i] == username)
				{
					html+="(self)";
				}
				else
				{
					html += "<input type=\"button\" class=\"banButton\" value=\"ban\" onclick=\"banUserInGroup(\'"+members[i]+"\');\"/>";
				}
			}
			
			html += "</div>";
		}
		
		var buttons = document.getElementsByClassName("banButton");
		var len = buttons.length;
		if(admin == username)
		{
			for(var i=0;i<len;i++)
			{
				buttons[i].disabled = false;
				//buttons[i].addEventListener("click",function(){
				//	banUserInGroup(members[i]);
				//});
			}
		}
		else
		{
			for(var i=0;i<len;i++)
			{
				buttons[i].disabled = true;
			}
		}
		
		var memberList = document.getElementById("members");
		memberList.innerHTML = html;
	}

	function displayLogin(success)
	{
		if(success == 1)
		{
			var loginCover = document.getElementById("cover");
			var loginFrame = document.getElementById("loginDiv");
	
			loginCover.style.display = "none";
			loginFrame.style.display = "none";
			
			addUserInGroup(username);
		}
		else
		{
			var loginResult = document.getElementById("loginResult");
			loginResult.innerHTML = "Username duplicated, choose another please."
		}
	}
	
	var inviteButton = document.getElementById("invite");
	inviteButton.onclick = function()
	{
		var nameField = document.getElementById("searchName");
		if(nameField.value == "")
			return;
		else
			socket.emit("inviteUser",{username:nameField.value,host:username,group:groupId});
	};
	
	socket.on('userInvited',function(data){
		if(data.err == -1)
		{
			alert(err);
			return;
		}
		if(data.result == true)
		{
			displayGroupMembers(data.members,data.admin);
			//addUserInGroup(data.username);
			groupId = data.group;
			
			if(data.admin == username)
				inviteButton.disabled = false;
			else
				inviteButton.disabled = true;
		}
		else
		{
			var inviteResult = document.getElementById("inviteResult");
			inviteResult.innerHTML = "User not exists or declined invitation";
		}
	});
	
	socket.on('invitationReceived',function(data){
		var result = confirm("You are invited by user: "+data.username+", join?");
		socket.emit('inviteAccept',{accept:result,host:data.username,invited:username,group:data.group});
	});
	
	socket.on('userBanned',function(data){
		if(data.bannedUser == username)
		{
			alert("You are banned by "+data.admin+" from group, bye!");
			var memberList = document.getElementById("members");
			memberList.innerHTML = "<div class=\"chatMember\">"+username+"</div>";
			inviteButton.disabled = false;
		}
		else
		{
			displayGroupMembers(data.members,data.admin);
		}
	});
	
	var files;
	function handleFileSelect(evt) {
	    evt.stopPropagation();
	    evt.preventDefault();

	    files = evt.dataTransfer.files; // FileList object.
		
		file = files[0];
		if(!isImage(file)&&!isVideo(file))
		{
			alert("Sorry, not supported format.");
			return;
		}

	    // files is a FileList of File objects. List some properties.
	    var output = [];
	    for (var i = 0, f; f = files[i]; i++) {
	      output.push('<li><strong>', escape(f.name), '</strong> (', f.type || 'n/a', ') - ',
	                  f.size, ' bytes, last modified: ',
	                  f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a',
	                  '</li>');
	    }
	    document.getElementById('list').innerHTML = '<ul>' + output.join('') + '</ul>';
	  }

	  function handleDragOver(evt) {
	    evt.stopPropagation();
	    evt.preventDefault();
	    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
	  }

	  // Setup the dnd listeners.
	  var dropZone = document.getElementById('dropZone');
	  dropZone.addEventListener('dragover', handleDragOver, false);
	  dropZone.addEventListener('drop', handleFileSelect, false);
	  
	  var reader;
	  var file;
  	sendMediaButton.onclick = function(){
  		reader = new FileReader();
		
		file = files[0];
		if(isImage(file))
		{
			reader.onload = function(){
				socket.emit('send',{image:true,buffer:reader.result,username:username,group:groupId});
				uploadFinished();
			};
			reader.readAsDataURL(file);
		}
		else
		{
			reader.onload=function(){
				socket.emit('proceedUpload',{video:true,filename:file.name,size:file.size,filetype:file.type,username:username,group:groupId,data:reader.result});
			};
			
			socket.emit('startUpload',{video:true,filename:file.name,size:file.size,filetype:file.type,username:username,group:groupId});
			sendMediaButton.disabled = true;
		}
  	};
	var progressBar = document.getElementById("progress");
	
	socket.on('moreData',function(data){
		var place = data.place * 524288;
		var newFile;
		progressBar.innerHTML = data.percent +"%";
		
		if(file.slice)
		{
			newFile = file.slice(place,place+Math.min(524288,(file.size-place)));
		}
		else
		{
			newFile = file.mozSlice(place,place+Math.min(524288,(file.size-place)));
		}
		reader.readAsBinaryString(newFile);
	});
	
	function uploadFinished()
	{
		progressBar.innerHTML = "100%";
		sendMediaButton.disabled = false;
		document.getElementById("list").innerHTML = "";
		dropZone.innerHTML = "Drop image/video here";
	}
	
	socket.on('finishUpload',function(data){
		uploadFinished();
	});
}

function banUserInGroup(name)
{
	socket.emit('banUser',{group:groupId,bannedUser:name,requestUser:username});
}

