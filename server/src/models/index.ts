import { DataTypes, type Sequelize } from "sequelize";

export function defineModels(sequelize: Sequelize) {
  const Role = sequelize.define(
    "Role",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      // Set on every edit. Tokens issued before this time are rejected.
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "roles",
      timestamps: false,
    },
  );

  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false,
      },
      passwordHash: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      // The role's name lives on the roles table, so renaming a role never touches users.
      roleId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "roles", key: "id" },
      },
      canCreateGroup: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      canSendMessage: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      // Set whenever the permissions change. Tokens issued before this time are rejected.
      permissionsUpdatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "users",
      timestamps: false,
    },
  );

  const Group = sequelize.define(
    "Group",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: {
        type: DataTypes.STRING(100),
        unique: true,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdById: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
      },
      // Null for open groups such as General. Groups with a password store a bcrypt hash.
      passwordHash: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "groups",
      timestamps: false,
    },
  );

  const GroupMember = sequelize.define(
    "GroupMember",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      groupId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "groups", key: "id" },
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
      joinedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "group_members",
      timestamps: false,
    },
  );

  const Message = sequelize.define(
    "Message",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      groupId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "groups", key: "id" },
      },
      senderId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "messages",
      timestamps: false,
    },
  );

  Role.hasMany(User, { foreignKey: "roleId" });
  User.belongsTo(Role, { foreignKey: "roleId" });

  User.hasMany(Group, { foreignKey: "createdById", as: "createdGroups" });
  Group.belongsTo(User, { foreignKey: "createdById", as: "createdBy" });

  User.hasMany(GroupMember, { foreignKey: "userId" });
  Group.hasMany(GroupMember, { foreignKey: "groupId" });
  GroupMember.belongsTo(User, { foreignKey: "userId" });
  GroupMember.belongsTo(Group, { foreignKey: "groupId" });

  User.hasMany(Message, { foreignKey: "senderId" });
  Group.hasMany(Message, { foreignKey: "groupId" });
  Message.belongsTo(User, { foreignKey: "senderId" });
  Message.belongsTo(Group, { foreignKey: "groupId" });

  return { Role, User, Group, GroupMember, Message };
}
