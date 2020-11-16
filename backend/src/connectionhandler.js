const RoomMaxPersons = 4;

ActiveRooms = []
ids = [];
cleaning = false;

function cleaner() {
    if (!cleaning) {
        cleaning = true;
        setTimeout(()=> {
            if (ids.length < 1) {return};
            ActiveRooms.forEach((element, index) => {
                element.Players.forEach((element2, index2) => {
                    if (!ids.includes(element2.Id)) {
                        ActiveRooms[index].Players.splice(index2,1);
                        ActiveRooms[index].Players.forEach((element3) => {
                            element3.socket.emit('UserLeave', JSON.stringify({RoomId: element.Id, UserLeaved: element2.Id}))
                        })
                    }
                })
            })
            ActiveRooms.forEach((element, index) => {
                if (element.Players.length === 0) {
                    ActiveRooms.splice(index,1);
                }
            })
            ids = [];
            cleaning = false;
        }, 15000);
    }
}

function getRandomString(length) {
    var randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var result = '';
    for ( var i = 0; i < length; i++ ) {
        result += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }
    return result;
}

function reconnect(socket) {
    socket.broadcast.emit('reconnect');
    cleaner();
}

function GenerateRoom(socket, Data) {
    RoomScheme = {
        Id: '',
        Players : [],
    }
    
    PlayerScheme = {
        Id: "",
        socket,
        Name: "",
    }
    Data = JSON.parse(Data);
    var RoomId = getRandomString(7);
    ActiveRooms.forEach((element, index) => {
        if (element.Id === RoomId) {
            GenerateRoom(socket, Data);
            return;
        }
    })
    RoomScheme.Id = RoomId;
    ActiveRooms.push(RoomScheme)
    socket.emit('RoomId', JSON.stringify({RoomId: RoomScheme.Id}))
}

function Updater(socket, Data) {
    Data = JSON.parse(Data);
    ActiveRooms.forEach((element, index)=> {
        element.Players.forEach((element2, index2) => {
            if (element2.Id === Data.oldUserId) {
                ActiveRooms[index].Players[index2].Id = Data.userId;
                ids.push(Data.userId);
                cleaner();
            } else {
                element2.socket.emit("UpdateUserId", JSON.stringify({RoomId: element.Id, OldId: Data.oldUserId, NewId: Data.userId}))
            }
        })
    })
}

function verifyer(socket, executer, Data, UserIn) {
    if (UserIn === undefined) {
        UserIn = true;
    }
    Data = JSON.parse(Data);
    var RoomContainsUser = false;
    var RoomExists = false;
    ActiveRooms.forEach((element, index)=>{
        if (element.Id === Data.RoomId) {
            RoomExists = true;
            ActiveRooms[index].Players.forEach((element2, index2)=>{
                if (element2.Id === Data.UserId) {
                    RoomContainsUser = true;
                }
            })
        }    
    })
    if ((RoomContainsUser && UserIn) || (RoomExists && !UserIn)) {
        executer(socket, Data)
    } else if (RoomExists && UserIn) {
        socket.emit('ConnectionFailed');
    } else {
        socket.emit('RoomNotExists');
    }
}

function LogUserIn(socket, Data) {
    RoomAlreadyContainsUser = false;
    ActiveRooms.forEach((element, index)=>{
        if (element.Id === Data.RoomId) {
            if (ActiveRooms[index].Players.length >= RoomMaxPersons) {
                socket.emit('FullRoom');
                RoomAlreadyContainsUser = true;
            }
            ActiveRooms[index].Players.forEach((element2)=>{
                if (element2.Id === Data.UserId) {
                    RoomAlreadyContainsUser = true;
                }
            })
        }    
    })
    if (!RoomAlreadyContainsUser) {
        RoomIndex = 0;
        ActiveRooms.forEach((element, index)=>{
            if (element.Id === Data.RoomId) {
                RoomIndex = index;
                ActiveRooms[index].Players.forEach((element2)=>{
                    element2.socket.emit('NewUser', JSON.stringify({RoomId: element.Id, EnteredUserId: Data.UserId}))
                    socket.emit('NewUser', JSON.stringify({RoomId: element.Id, EnteredUserId: element2.Id}))
                })
            }    
        })
        PlayerScheme = {
            Id: "",
            socket,
            Name: "",
        }
        PlayerScheme.Id = Data.UserId;
        PlayerScheme.socket = socket;
        ActiveRooms[RoomIndex].Players.push(PlayerScheme);
        socket.emit('NewUser', JSON.stringify({RoomId: Data.RoomId, EnteredUserId: Data.UserId}))
    }
}

function RegisterUserName(socket, Data) {
    ActiveRooms.forEach((element, index)=>{
        if (element.Id === Data.RoomId) {
            ActiveRooms[index].Players.forEach((element2, index2)=>{
                if (element2.Id === Data.UserId) {
                    ActiveRooms[index].Players[index2].Name = Data.UserName;
                }
                socket.emit('UserNameInformation', JSON.stringify({RoomId: element.Id, UserId: element2.Id, NickName: element2.Name}))
            })
        }    
    })
    ActiveRooms.forEach((element) => {
        element.Players.forEach((element2) => {
            element.Players.forEach((element3) => {
                element2.socket.emit('UserNameInformation', JSON.stringify({RoomId: element.Id, UserId: element3.Id, NickName: element3.Name}))
            })
        })
    })
}

module.exports = (io) => {
    io.on('connection', (socket) => {
        socket.on('GenerateRoom', (Data) => {GenerateRoom(socket, Data)});
        socket.on('disconnect', () => {reconnect(socket)});
        socket.on('Reconnector', (Data) => {Updater(socket, Data)});
        socket.on('RegisterUser', (Data) => {verifyer(socket, LogUserIn, Data, false)})
        socket.on('RegisterUserName', (Data) => {verifyer(socket, RegisterUserName, Data)})
    });
};