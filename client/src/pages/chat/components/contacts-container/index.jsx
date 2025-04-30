import Logo from '@/assets/logo.svg'
import ProfileInfo from './components/profile-info';
import NewDm from './components/profile-info/new-dm';
import { useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { GET_DM_CONTACTS_ROUTES, GET_USER_CHANNELS_ROUTE } from '@/utils/constants';
import { useAppStore } from '@/store';
import ContactList from '@/components/contact-list.jsx';
import CreateChannel from './components/create-channel';

const ContactsContainer = () => {

  const { setDirectMessagesContacts, directMessagesContacts, channels, setChannels } = useAppStore();

  useEffect(() => {
    const getContacts = async () => {
      const response = await apiClient.get(GET_DM_CONTACTS_ROUTES,
        { withCredentials: true,
        });
        if (response.data.contacts) {
          setDirectMessagesContacts(response.data.contacts);
        }
    }
    const getChannels = async () => {
      const response = await apiClient.get(GET_USER_CHANNELS_ROUTE,
        { withCredentials: true,
        });
        if (response.data.channels) {
          setChannels(response.data.channels);
        }
    }

    getContacts();
    getChannels();
  }, [setChannels, setDirectMessagesContacts]);

  return (
    <div className="relative md:w-[35vw] lg:w-[30vw]
     xl:w-[20vw] bg-[#1b1c24] border-r-2 border-[#2f303b] w-full">
      <div className="pt-3">
        <img src={Logo} alt="Logo" className="h-[5rem]" />
      </div>
      <div className='my-5'>
        <div className='flex items-center justify-between pr-10'>
            <Title text="Чаты" />
            <NewDm />
        </div>
        <div className='max-h-[38vh] overflow-y-auto scrollbar-hidden'>
          <ContactList contacts={ directMessagesContacts } />
        </div>
      </div>
      <div className='my-5'>
        <div className='flex items-center justify-between pr-10'>
            <Title text="Группы" />
            <CreateChannel />
        </div>
        <div className='max-h-[38vh] overflow-y-auto scrollbar-hidden'>
          <ContactList contacts={ channels } isChannel={ true }/>
        </div>
      </div>
      <ProfileInfo />
     </div>
  )
}

export default ContactsContainer;

const Title = ({text}) => {
  return (
    <h6 className='uppercase tracking-widest text-neutral-400 pl-10 font-light text-opacity-90 text-sm'>
      {text}
    </h6>
  )
}