export const HOST = import.meta.env.VITE_SERVER_URL;

export const AUTH_ROUTES = "api/auth";
export const SIGNUP_ROUTE = `${AUTH_ROUTES}/signup`;
export const LOGIN_ROUTE = `${AUTH_ROUTES}/login`;
export const GET_USER_INFO = `${AUTH_ROUTES}/user-info`;
export const UPDATE_PROFILE_ROUTE = `${AUTH_ROUTES}/update-profile`;
export const ADD_PROFILE_IMAGE_ROUTE = `${AUTH_ROUTES}/add-profile-image`;
export const REMOVE_PROFILE_IMAGE_ROUTE = `${AUTH_ROUTES}/remove-profile-image`;
export const LOGOUT_ROUTE = `${AUTH_ROUTES}/logout`;

export const CONTACTS_ROUTES = "api/contacts";
export const SEARCH_CONTACTS_ROUTES = `${CONTACTS_ROUTES}/search`;
export const GET_DM_CONTACTS_ROUTES = `${CONTACTS_ROUTES}/get-contacts-for-dm`;
export const GET_ALL_CONTACTS_ROUTES = `${CONTACTS_ROUTES}/get-all-contacts`;

export const MESSAGES_ROUTES = "api/messages";
export const GET_ALL_MESSAGES_ROUTE = `${MESSAGES_ROUTES}/get-messages`;
export const UPLOAD_FILE_ROUTE = `${MESSAGES_ROUTES}/upload-file`;
export const GET_MESSAGE_FILE_ROUTE = `${MESSAGES_ROUTES}/file`;

export const CHANNEL_ROUTES = "api/channel";
export const CREATE_CHANNEL_ROUTE = `${CHANNEL_ROUTES}/create-channel`;
export const GET_USER_CHANNELS_ROUTE = `${CHANNEL_ROUTES}/get-user-channels`;
export const GET_CHANNEL_MESSAGES = `${CHANNEL_ROUTES}/get-channel-messages`;
export const GET_CHANNEL_ROUTE = `${CHANNEL_ROUTES}/get-channel`;
export const UPDATE_CHANNEL_ROUTE = `${CHANNEL_ROUTES}/update-channel`;
export const ADD_CHANNEL_MEMBERS_ROUTE = `${CHANNEL_ROUTES}/add-members`;
export const DELETE_CHANNEL_MEMBER_ROUTE = `${CHANNEL_ROUTES}/members`;
export const UPDATE_CHANNEL_MEMBER_ROLE_ROUTE = `${CHANNEL_ROUTES}/members`;
export const DELETE_CHANNEL_ROUTE = `${CHANNEL_ROUTES}/delete-channel`;

export const CALLS_ROUTES = "api/calls";
export const LIVEKIT_TOKEN_ROUTE = `${CALLS_ROUTES}/livekit-token`;

export const GET_PROFILE_PHOTOS_ROUTE = `${AUTH_ROUTES}/profile-photos`;
export const ADD_PROFILE_PHOTO_ROUTE = `${AUTH_ROUTES}/profile-photos`;
export const SET_AVATAR_PHOTO_ROUTE = `${AUTH_ROUTES}/profile-photos`;
export const CONTACT_PROFILE_ROUTE = `${CONTACTS_ROUTES}/profile`;

export const FRIENDS_ROUTES = "api/friends";
export const SEARCH_USERS_FOR_FRIENDSHIP_ROUTE = `${FRIENDS_ROUTES}/search-users`;
export const SEND_FRIEND_REQUEST_ROUTE = `${FRIENDS_ROUTES}/request`;
export const GET_INCOMING_FRIEND_REQUESTS_ROUTE = `${FRIENDS_ROUTES}/requests/incoming`;
export const GET_OUTGOING_FRIEND_REQUESTS_ROUTE = `${FRIENDS_ROUTES}/requests/outgoing`;
export const ACCEPT_FRIEND_REQUEST_ROUTE = `${FRIENDS_ROUTES}/request`;
export const REJECT_FRIEND_REQUEST_ROUTE = `${FRIENDS_ROUTES}/request`;
export const REMOVE_FRIEND_ROUTE = `${FRIENDS_ROUTES}`;
export const GET_FRIENDS_LIST_ROUTE = `${FRIENDS_ROUTES}/list`;
export const GET_FRIENDS_SELECTOR_ROUTE = `${FRIENDS_ROUTES}/selector`;
export const CANCEL_FRIEND_REQUEST_ROUTE = `${FRIENDS_ROUTES}/request`;
