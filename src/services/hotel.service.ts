import { Inject, Injectable } from '@nestjs/common';
import { FindOptions, Sequelize } from 'sequelize';
import { User } from '../models/user.model';
import { InstanceDoesNotExist } from '../classes/errors.class';
import { AddressService } from './address.service';
import { Company } from '../models/company.model';
import { Address } from "../models/address.model";
import { Location } from "../models/location.model";
import { Hotel } from "../models/hotel.model";
import { HotelDto } from "../dto/hotel.dto";

@Injectable()
export class HotelService {
  constructor(
    private readonly addressService: AddressService,
    @Inject('HotelModel') private readonly hotelModel: typeof Hotel,
    @Inject('UserModel') private readonly userModel: typeof User,
    @Inject('SEQUELIZE') private readonly sequelize: Sequelize
  ) {}

  async getHotelsForUser(userId: number): Promise<HotelDto[]> {
    // get user with company
    const user = await this.userModel.findByPk(userId);

    // check company existing
    if (!user!.companyId) {
      throw new InstanceDoesNotExist('Company');
    }

    const hotels = await this.hotelModel.findAll({
      where: { companyId: user!.companyId },
      include: [
        {
          model: Address,
          include: [Location]
        }
      ]
    } as FindOptions);

    return hotels;
  }

  async getHotels(limit: number, offset: number): Promise<HotelDto[]> {
    const hotels = await this.hotelModel.findAll({
      include: [
        {
          model: Address,
          include: [Location]
        }
      ],
      order: [['rating', 'DESC']],
      limit: Number(limit),
      offset: Number(offset)
    } as FindOptions);

    return hotels;
  }

  async createHotel(hotelDto: HotelDto, userId: number): Promise<HotelDto> {
    const transaction = await this.sequelize.transaction();

    try {
      // get user and check company existing
      const user = await this.userModel.findByPk(userId, { transaction });

      if (!user!.companyId) {
        throw new InstanceDoesNotExist('Company');
      }

      // create address
      const address = await this.addressService.createAddress(hotelDto.address, transaction);

      // todo add checking hotel name and phone

      const hotel = await this.hotelModel.create(
        {
          name: hotelDto.name,
          description: hotelDto.description,
          phone: hotelDto.phone,
          addressId: address.id,
          companyId: user!.companyId
        } as Hotel,
        { transaction }
      );

      await transaction.commit();

      return hotel;
    } catch (err) {
      await transaction.rollback();

      throw err;
    }
  }
}
