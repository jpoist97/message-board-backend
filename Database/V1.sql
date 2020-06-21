create table Person (
   id int auto_increment primary key,
   firstName varchar(30),
   lastName varchar(50) not null,
   email varchar(150) not null,
   password varchar(50),
   whenRegistered BIGINT not null,
   termsAccepted BIGINT,
   role int unsigned not null,  # 0 normal, 1 admin
   unique key(email)
);

create table Conversation (
   id int auto_increment primary key,
   ownerId int,
   title varchar(80) not null,
   lastMessage BIGINT,
   constraint FKMessage_ownerId foreign key (ownerId) references Person(id)
    on delete cascade,
   unique key UK_title(title)
);

create table Message (
   id int auto_increment primary key,
   cnvId int not null,
   email varchar(30) not null,
   whenMade BIGINT not null,
   content varchar(5000) not null,
   numLikes int not null,
   constraint FKMessage_cnvId foreign key (cnvId) references Conversation(id)
    on delete cascade,
   constraint FKMessage_email foreign key (email) references Person(email)
    on delete cascade
);


create table Likes (
   id int auto_increment primary key,
   msgId int not null,
   cnvId int not null,
   ownerId int,
   firstName varchar(30),
   lastName varchar(50) not null
);

insert into Person (firstName, lastName, email, password, whenRegistered, role)
   VALUES ("Joe", "Admin", "adm@11.com", "password", 
    UNIX_TIMESTAMP() * 1000, 1);
