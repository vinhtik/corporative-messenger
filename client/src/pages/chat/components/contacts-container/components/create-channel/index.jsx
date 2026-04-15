import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { FaPlus } from "react-icons/fa";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import {
  CREATE_CHANNEL_ROUTE,
  GET_FRIENDS_SELECTOR_ROUTE,
} from "@/utils/constants";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import MultipleSelector from "@/components/ui/multipleselect";
import { toast } from "sonner";

const CreateChannel = () => {
  const { addChannel } = useAppStore();

  const [newChannelModal, setNewChannelModal] = useState(false);
  const [friendOptions, setFriendOptions] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [channelName, setChannelName] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!newChannelModal) return;

    const getData = async () => {
      try {
        const response = await apiClient.get(GET_FRIENDS_SELECTOR_ROUTE, {
          withCredentials: true,
        });

        setFriendOptions(response.data?.friends || []);
      } catch (error) {
        console.log(error);
        toast.error("Не удалось загрузить друзей");
      }
    };

    getData();
  }, [newChannelModal]);

  const createChannel = async () => {
    try {
      if (!channelName.trim()) {
        toast.error("Введите название группы");
        return;
      }

      if (!selectedFriends.length) {
        toast.error("Выберите хотя бы одного друга");
        return;
      }

      setIsBusy(true);

      const response = await apiClient.post(
        CREATE_CHANNEL_ROUTE,
        {
          name: channelName.trim(),
          members: selectedFriends.map((friend) => friend.value),
        },
        { withCredentials: true }
      );

      if (response.status === 201) {
        setChannelName("");
        setSelectedFriends([]);
        setNewChannelModal(false);
        addChannel(response.data.channel);
        toast.success("Группа создана");
      }
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data || "Не удалось создать группу");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <FaPlus
              className="text-muted-foreground font-light text-opacity-90 text-start hover:text-foreground cursor-pointer transition-all duration-200"
              onClick={() => setNewChannelModal(true)}
            />
          </TooltipTrigger>
          <TooltipContent className="bg-popover border-none mb-2 p-3 text-popover-foreground">
            Новая группа
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={newChannelModal} onOpenChange={setNewChannelModal}>
        <DialogContent className="bg-card border border-border text-card-foreground w-[400px] h-[400px] flex flex-col">
          <DialogHeader>
            <DialogTitle>Создание группы</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              В группу можно приглашать только друзей.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Input
              placeholder="Название группы"
              className="rounded-lg p-6 bg-background border-border"
              onChange={(e) => setChannelName(e.target.value)}
              value={channelName}
              disabled={isBusy}
            />
          </div>

          <MultipleSelector
            className="rounded-lg bg-background border-border py-2 text-foreground"
            options={friendOptions}
            placeholder="Выбрать друзей"
            value={selectedFriends}
            onChange={setSelectedFriends}
            emptyIndicator={
              <p className="text-center text-lg leading-10 text-muted-foreground">
                Нет доступных друзей
              </p>
            }
          />

          <div>
            <Button
              className="w-full bg-green-700 hover:bg-green-900 transition-all duration-200"
              onClick={createChannel}
              disabled={isBusy}
            >
              Создать группу
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreateChannel;
