var express = require("express");
var fs = require("fs");
var app = express();
var port = 80;

var allUsers = [];
var allGroups = {};
var allFiles = {};
var allClientSockets = {};
var allSocketByUser = {};
var adminByGroup = {};

app.set('views',__dirname+'/tpl');
app.set('view engine',"ejs");
//app.engine('jade',require('jade').__express);
app.use(express.static(__dirname + '/public'));

app.get("/", function(req,res) {
	//res.send("It works");
	res.render("index.html");
});

function ensureExists(path,callback)
{
	var mask = 0777;
	fs.mkdir(path,mask,function(err){
		if(err)
		{
			if(err.code == 'EEXIST')
				callback(null);
			else
				callback(err);
		}
		else
			callback(err);
	});
}

//app.listen(port);
var io = require('socket.io').listen(app.listen(port));

io.sockets.on('connection', function (socket){
	socket.emit('message',{message: 'welcome to the chat', username: 'System'});
	socket.on('send',function(data){
		sendData(data);
		//io.sockets.emit('message',data);
	});
	
	function sendData(data)
	{
		if(data.group == -1)
		{
			socket.emit('message',data);
		}
		else
		{
			var members = allGroups[data.group];
			var len = members.length;
			console.log("message in group: "+data.group+", members: "+members);
			for(var i=0;i<len;i++)
			{
				var user = members[i];
				//console.log("current user: "+user);
				var socId = allSocketByUser[user];
				var userSoc = allClientSockets[socId];
				userSoc.emit('message',data);
			}
		}
	}
	
	socket.on('login',function(data){
		var idx = allUsers.indexOf(data.username);
		if(idx == -1)
		{
			allUsers.push(data.username);
			socket.emit('loginResult',{result:1});//userid not found, login successful
			allClientSockets[socket.id] = socket;
			allSocketByUser[data.username] = socket.id;
		}
		else
			socket.emit('loginResult',{result:-1});//userid found, login failed
	});
	
	socket.on('inviteUser',function(data){
		var idx = allUsers.indexOf(data.username);
		if(idx == -1)
		{
			socket.emit('alertError',{error:"User does not exist"});
			return;
		}
		var socketId = allSocketByUser[data.username];
		var socketInvited = allClientSockets[socketId];
		
		socketInvited.emit('invitationReceived',{username:data.host,group:data.group});
	});
	
	socket.on('inviteAccept',function(data){
		var hostId = allSocketByUser[data.host];
		var socketHost = allClientSockets[hostId];
		var groupId = -1;
		var err = -1;
		
		if(data.accept == true)
		{
			var members = [];
			if(data.group == -1)
			{
				groupId = data.host+Date.now();
				
				members[0] = data.host;
				members[1] = data.invited;
				
				allGroups[groupId] = members;
				adminByGroup[groupId] = data.host;
				
				console.log("new group created: "+groupId);
			}
			else
			{
				groupId = data.group;
				members = allGroups[groupId];
				if(members.length ==5)
				{
					err = "5 users per group maximal, cannot add more";
				}
				else
				{
					members.push(data.invited);
				}
			}
			var len = members.length;
			for(var i=0;i<len;i++)
			{
				var invitedId = allSocketByUser[members[i]];
				var socketInvited = allClientSockets[invitedId];
				socketInvited.emit('userInvited',{result:data.accept,admin:data.host,members:members,group:groupId,error:err});
			}
		}
	});
	
	socket.on('banUser',function(data){
		var admin = adminByGroup[data.group];
		console.log("request user: "+data.requestUser+" ,admin: "+admin);
		if(admin == -1 || admin != data.requestUser)
			return;
		
		var members = allGroups[data.group];
		var idx = members.indexOf(data.bannedUser);
		
		members.splice(idx,1);
		
		var len = members.length;
		for(var i=0;i<len;i++)
		{
			var userId = allSocketByUser[members[i]];
			var socketUser = allClientSockets[userId];
			socketUser.emit('userBanned',{bannedUser:data.bannedUser,admin:admin,members:members,group:data.group});
		}
		
		var userId = allSocketByUser[data.bannedUser];
		var socketUser = allClientSockets[userId];
		socketUser.emit('userBanned',{bannedUser:data.bannedUser,admin:admin,members:members,group:data.group});
	});
	
	socket.on('startUpload',function(data){
		var filename = data.filename;
		var folderGroup = "/temp/"+data.group+"/";
		var folderDate = Date.now()+"/";
		var linkBase = folderGroup+folderDate;
		folderGroup = "public"+folderGroup;
		allFiles[filename] = {size:data.size,data:"",downloaded:0,handler:0,filetype:data.filetype,folder:"public/"+linkBase,link:linkBase+filename};
		var folder = allFiles[filename].folder;
		ensureExists(folderGroup,function(err){
			ensureExists(folderGroup+folderDate,function(err){
				var place = 0;
				try
				{
					var stat = fs.statSync(folder+filename);
					if(stat.isFile())
					{
						allFiles[filename].downloaded = stat.size;
						place = stat.size / 524288;
					}
				}
				catch(err){}
				fs.open(folder+filename,"a",0755,function(err,fd){
					if(err)
					{
						console.log(err);
					}
					else
					{
						allFiles[filename].handler = fd;
						socket.emit('moreData',{place:place,percent:0});
					}
				});
			});
		});
	});
	
	socket.on('proceedUpload',function(data){
		var filename = data.filename;
		var file = allFiles[filename];
		file.downloaded += data.data.length;
		file.data += data.data;
		if(file.downloaded == file.size)//download fini
		{
			fs.write(file.handler,file.data,null,'Binary',function(err,writen){
				//get thunbnail here
				socket.emit('finishUpload',{filename:filename});
				var msg = {username:data.username,group:data.group,video:true,link:file.link,filename:filename,filetype:file.filetype};
				sendData(msg);
			});
		}
		else
		{
			if(file.data.length > 10485760)//data buffer reaches 10MB
			{
				fs.write(file.handler,file.data,null,'Binary',function(err,written){
					file.data = "";//reset buffer
					var place = file.downloaded / 524288;
					var percent = file.downloaded/file.size *100;
					socket.emit('moreData',{place:place,percent:percent});
				});
			}
			else
			{
				var place = file.downloaded/524288;
				var percent = file.downloaded/file.size*100;
				socket.emit('moreData',{place:place,percent:percent});
			}
		}
	});
});
console.log("Listening on port "+port);
